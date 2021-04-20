package rosterapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

type setOverwriteRequest struct {
	Username    string `json:"username"`
	Phone       string `json:"phoneNumber"`
	DisplayName string `json:"displayName"`
}

// SetOverwriteEndpoint allows to configure the duty roster overwrite.
func SetOverwriteEndpoint(router *app.Router) {
	router.POST(
		"v1/overwrite",
		permission.OneOf{
			WriteRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			date := c.Query("date")

			if date == "" {
				date = dateForCurrentRoster(ctx, app)
			}

			d, err := app.ParseTime("2006-1-2", date)
			if err != nil {
				return httperr.InvalidParameter("date")
			}

			var body setOverwriteRequest
			if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
				return httperr.BadRequest(err)
			}

			if body.Username != "" {
				user, err := app.Identities.GetUser(ctx, body.Username)
				if err != nil {
					return err
				}
				if user.Disabled {
					return httperr.BadRequest(nil, "user is disabled")
				}
			}

			if err := app.DutyRosters.SetOverwrite(ctx, d, body.Username, body.Phone, body.DisplayName); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}

func dateForCurrentRoster(ctx context.Context, app *app.App) string {
	t := time.Now()
	// find out if we need the doctor-on-duty from today or the day before
	// depending on the ChangeOnDuty time for today.
	changeDutyAt := app.Door.ChangeOnDuty(ctx, t)
	if !changeDutyAt.IsApplicable(t) {
		t.Add(-24 * time.Hour)
	}

	return t.Format("2006-1-2")
}
