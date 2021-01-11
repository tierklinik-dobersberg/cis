package externalapi

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
)

// CurrentDoctorOnDutyEndpoint provides a specialized endpoint
// to receive information about the current doctor on duty
// an any backups.
func CurrentDoctorOnDutyEndpoint(grp gin.IRouter) {
	grp.GET("v1/doctor-on-duty", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		log := logger.From(c.Request.Context())

		now := time.Now()
		roster, err := app.DutyRosters.ForMonth(c.Request.Context(), now.Month(), now.Year())
		if err != nil {
			if errors.Is(err, rosterdb.ErrNotFound) {
				server.AbortRequest(c, http.StatusNotFound, err)
				return
			}

			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		day, ok := roster.Days[now.Day()]
		if !ok {
			server.AbortRequest(c, http.StatusNotFound, fmt.Errorf("no duty roster for %04d/%02d/%02d", now.Year(), int(now.Month()), now.Day()))
			return
		}

		allUsers, err := app.Identities.ListAllUsers(c.Request.Context())
		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
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
				Username: u.Name,
				Fullname: u.Fullname,
				Phone:    user.PhoneNumber[0],
			}
		}

		c.JSON(http.StatusOK, doctorsOnDuty)
	})
}
