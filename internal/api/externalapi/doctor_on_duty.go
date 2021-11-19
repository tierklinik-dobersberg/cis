package externalapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/external/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/mongo"
)

// CurrentDoctorOnDutyEndpoint provides a specialized endpoint
// to receive information about the current doctor on duty
// an any backups.
func CurrentDoctorOnDutyEndpoint(grp *app.Router) {
	grp.GET(
		"v1/doctor-on-duty",
		permission.OneOf{
			ReadOnDutyAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			d := time.Now()
			if at := c.Query("at"); at != "" {
				var err error
				d, err = app.ParseTime(time.RFC3339, at)
				if err != nil {
					return httperr.InvalidParameter("at", err.Error())
				}
			}

			response, err := getDoctorOnDuty(ctx, app, d)
			if err != nil {
				return err
			}
			c.JSON(http.StatusOK, response)
			return nil
		},
	)
}

func activeOverwrite(ctx context.Context, app *app.App, t time.Time, lm map[string]cfgspec.User) *v1alpha.DoctorOnDutyResponse {
	log := log.From(ctx)
	// first check if we have an active overwrite for today
	overwrite, err := app.DutyRosters.GetActiveOverwrite(ctx, t)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return nil
	}

	if err != nil {
		log.Errorf("failed to find active overwrite for %s", t)
		return nil
	}

	if overwrite.DisplayName == "" {
		overwrite.DisplayName = "Manual Overwrite"
	}

	log.WithFields(logger.Fields{
		"overwrite": overwrite,
	}).Infof("found active overwrite, using that instead")

	parsed, err := phonenumbers.Parse(overwrite.PhoneNumber, app.Config.Country)
	if err == nil {
		overwrite.PhoneNumber = strings.ReplaceAll(
			phonenumbers.Format(parsed, phonenumbers.NATIONAL),
			" ",
			"",
		)
	} else {
		var phone string
		user, ok := lm[overwrite.Username]
		if !ok || overwrite.Username == "" {
			log.Errorf("found invalid emergency duty overwrite for %s", t)
			return nil
		}

		if len(user.PhoneNumber) > 0 {
			phone = user.PhoneNumber[0]
		}

		return &v1alpha.DoctorOnDutyResponse{
			Doctors: []v1alpha.DoctorOnDuty{
				{
					FullName:   user.Fullname,
					Phone:      phone,
					Username:   user.Name,
					Properties: user.Properties,
				},
			},
			Until:       overwrite.To,
			IsOverwrite: true,
		}
	}

	return &v1alpha.DoctorOnDutyResponse{
		Doctors: []v1alpha.DoctorOnDuty{
			{
				FullName: overwrite.DisplayName,
				Phone:    overwrite.PhoneNumber,
				Username: overwrite.Username,
			},
		},
		Until:       overwrite.To,
		IsOverwrite: true,
	}
}

func getDoctorOnDuty(ctx context.Context, app *app.App, t time.Time) (*v1alpha.DoctorOnDutyResponse, error) {
	log := log.From(ctx)
	t = t.In(app.Location())

	// fetch all users so we can convert usernames to phone numbers,
	// ...
	allUsers, err := app.Identities.ListAllUsers(
		identitydb.WithScope(ctx, identitydb.Public),
	)
	if err != nil {
		return nil, httperr.InternalError(err)
	}

	// build a small lookup map by username.
	lm := make(map[string]cfgspec.User, len(allUsers))
	for _, u := range allUsers {
		lm[strings.ToLower(u.Name)] = u
	}

	// check if there's an active overwrite for t. In this case, just return
	// that one and we're done.
	if res := activeOverwrite(ctx, app, t, lm); res != nil {
		return res, nil
	}

	// find out if we need to the doctor-on-duty from today or the day before
	// depending on the ChangeOnDuty time for today.
	changeDutyAt := app.Door.ChangeOnDuty(ctx, t)
	var nextChange time.Time
	var isDayShift bool

	if changeDutyAt.IsApplicable(t) {
		if changeDutyAt.IsDayShift(t) {
			nextChange = changeDutyAt.NightStartAt(t)
			isDayShift = true
		} else {
			isDayShift = false
			nextDay := t.Add(24 * time.Hour)
			nextDayChange := app.Door.ChangeOnDuty(ctx, nextDay)
			nextChange = nextDayChange.DayStartAt(nextDay)
		}
	} else {
		// we're during the night-shift of the previous day
		// so we need to load that to get the responsible staff.
		nextChange = changeDutyAt.DayStartAt(t)
		newT := t.Add(-24 * time.Hour)
		log.V(7).Logf("switching lookup time from %s to %s the previous night shift is active", t, newT)
		t = newT
	}

	log = log.WithFields(logger.Fields{
		"nextChange": nextChange.Format(time.RFC3339),
	})

	day, err := app.DutyRosters.ForDay(ctx, t)
	if err != nil {
		return nil, err
	}

	// Get the correct username slice. If there's no "day-shift"
	// configured we fallback to the night shift.
	// TODO(ppacher): make this configurable or at least make sure
	// everyone knows that!
	var (
		activeShift  []string
		isNightShift = !isDayShift
	)
	if isDayShift && len(day.OnCall.Day) > 0 {
		activeShift = day.OnCall.Day
		log.WithFields(logger.Fields{
			"users": activeShift,
		}).Infof("using day shift")
	} else {
		activeShift = day.OnCall.Night
		isNightShift = true
		if isDayShift {
			log.WithFields(logger.Fields{
				"users": activeShift,
			}).Infof("no day shift defined, falling back to night shift.")
		}
	}

	if len(activeShift) == 0 {
		return nil, httperr.NotFound("doctor-on-duty", "no onCall shifts defined", nil)
	}

	// convert all the usernames from the Emergency slice to their
	// v1alpha.DoctorOnDuty API model.
	doctorsOnDuty := make([]v1alpha.DoctorOnDuty, len(activeShift))
	for idx, u := range activeShift {
		user, ok := lm[u]
		if !ok {
			log.Errorf("unknown user %s configured as doctor-on-duty", u)
		}

		var phone string
		if len(user.PhoneNumber) > 0 {
			phone = user.PhoneNumber[0]
		}

		doctorsOnDuty[idx] = v1alpha.DoctorOnDuty{
			Username:   user.Name,
			FullName:   user.Fullname,
			Phone:      phone,
			Properties: user.Properties,
		}
	}

	return &v1alpha.DoctorOnDutyResponse{
		Doctors:      doctorsOnDuty,
		Until:        nextChange,
		IsOverwrite:  false,
		IsDayShift:   isDayShift,
		IsNightShift: isNightShift,
	}, nil
}
