package externalapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/external/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
)

// CurrentDoctorOnDutyEndpoint provides a specialized endpoint
// to receive information about the current doctor on duty
// an any backups.
func CurrentDoctorOnDutyEndpoint(grp *app.Router) {
	grp.GET(
		"v1/doctor-on-duty",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			log := logger.From(ctx)

			now := time.Now()
			key := fmt.Sprintf("%04d/%02d/%02d", now.Year(), int(now.Month()), now.Day())

			roster, err := app.DutyRosters.ForMonth(ctx, now.Month(), now.Year())
			if err != nil {
				if errors.Is(err, rosterdb.ErrNotFound) {
					return httperr.NotFound("roster", key, err)
				}

				return httperr.InternalError(err)
			}

			day, ok := roster.Days[now.Day()]
			if !ok {
				return httperr.NotFound("roster-day", key, nil)
			}

			allUsers, err := app.Identities.ListAllUsers(ctx)
			if err != nil {
				return httperr.InternalError(err)
			}

			lm := make(map[string]schema.User, len(allUsers))
			for _, u := range allUsers {
				lm[strings.ToLower(u.Name)] = u
			}

			doctorsOnDuty := make([]v1alpha.DoctorOnDuty, len(day.Emergency))
			for idx, u := range day.Emergency {
				user, ok := lm[u]
				if !ok {
					log.Errorf("unknown user %s configured as doctor-on-duty", u)
				}

				if len(user.PhoneNumber) == 0 {
					log.Errorf("user %s does not have a phone number registered, skipping to backup", user.Name)
					continue
				}

				doctorsOnDuty[idx] = v1alpha.DoctorOnDuty{
					Username: user.Name,
					FullName: user.Fullname,
					Phone:    user.PhoneNumber[0],
				}
			}

			c.JSON(http.StatusOK, doctorsOnDuty)
			return nil
		},
	)
}
