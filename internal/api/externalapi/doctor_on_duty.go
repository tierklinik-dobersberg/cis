package externalapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
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
					return httperr.InvalidParameter("at")
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

func getDoctorOnDuty(ctx context.Context, app *app.App, t time.Time) (*v1alpha.DoctorOnDutyResponse, error) {
	log := log.From(ctx)
	t = t.In(app.Location())

	// find out if we need to the doctor-on-duty from today or the day before
	// depending on the ChangeOnDuty time for today.
	changeDutyAt := app.Door.ChangeOnDuty(ctx, t)
	var nextChange time.Time
	var isDayShift bool

	log.V(7).Logf("searching doctor on duty for %s. Duty time frame changes on %s at %s", t, changeDutyAt.Weekday(), changeDutyAt)

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

	key := fmt.Sprintf("%04d/%02d/%02d", t.Year(), int(t.Month()), t.Day())
	log = log.WithFields(logger.Fields{
		"rosterDate": key,
	})

	// first check if we have an active overwrite for today
	overwrite, err := app.DutyRosters.GetOverwrite(ctx, t)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	if err == nil {
		// TODO(ppacher):
		// 		Overwrites always affect the day and the night shift.
		//		To make sure the users see the correct end-of-overwrite
		//		we might need to switch nextChange to the end of the night
		//		shift the next day. If we are already in the night shift
		// 		there is nothing to do.
		if isDayShift {
			nextDay := t.Add(24 * time.Hour)
			nextDayChange := app.Door.ChangeOnDuty(ctx, nextDay)
			nextChange = nextDayChange.DayStartAt(nextDay)
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
				log.Errorf("found invalid emergency duty overwrite for day %s", key)
				return nil, fmt.Errorf("invalid overwrite")
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
				Until:        nextChange,
				IsOverwrite:  true,
				IsDayShift:   isDayShift,
				IsNightShift: !isDayShift,
			}, nil
		}

		return &v1alpha.DoctorOnDutyResponse{
			Doctors: []v1alpha.DoctorOnDuty{
				{
					FullName: overwrite.DisplayName,
					Phone:    overwrite.PhoneNumber,
					Username: overwrite.Username,
				},
			},
			Until:        nextChange,
			IsOverwrite:  true,
			IsDayShift:   isDayShift,
			IsNightShift: !isDayShift,
		}, nil
	}

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
		return nil, fmt.Errorf("no onCall shifts defined")
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
