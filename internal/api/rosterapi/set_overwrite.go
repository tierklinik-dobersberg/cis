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
				date = dateForCurrent(ctx, app)
			}

			d, err := time.Parse("2006-1-2", date)
			if err != nil {
				return httperr.InvalidParameter("date")
			}

			var body setOverwriteRequest
			if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
				return httperr.BadRequest(err)
			}

			if err := app.DutyRosters.SetOverwrite(ctx, d, body.Username, body.Phone, body.DisplayName); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}

func dateForCurrent(ctx context.Context, app *app.App) string {
	t := time.Now()
	// find out if we need the doctor-on-duty from today or the day before
	// depending on the ChangeOnDuty time for today.
	changeDutyAt := app.Door.ChangeOnDuty(ctx, t)
	if t.Before(changeDutyAt) {
		// go back in time for one day. We don't care about minute/hours here
		// from now on.
		t = t.Add(-1 * time.Hour * 24)
	}

	return t.Format("2006-1-2")
}