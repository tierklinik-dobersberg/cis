package rosterapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

type setOverwriteRequest struct {
	Username    string    `json:"username"`
	Phone       string    `json:"phoneNumber"`
	DisplayName string    `json:"displayName"`
	From        time.Time `json:"from"`
	To          time.Time `json:"to"`
}

// CreateOverwriteEndpoint allows to configure a duty roster overwrite.
func CreateOverwriteEndpoint(router *app.Router) {
	router.POST(
		"v1/overwrite",
		permission.OneOf{
			WriteRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {

			var body setOverwriteRequest
			if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
				return httperr.BadRequest(err)
			}

			if body.From.IsZero() {
				return httperr.InvalidField("from")
			}
			if body.To.IsZero() {
				return httperr.InvalidField("to")
			}

			if body.Username != "" {
				user, err := app.Identities.GetUser(ctx, body.Username)
				if err != nil {
					return err
				}
				if user.Disabled != nil && *user.Disabled {
					return httperr.BadRequest("user is disabled")
				}
			}

			overwrite, err := app.DutyRosters.CreateOverwrite(ctx, body.From, body.To, body.Username, body.Phone, body.DisplayName)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, overwrite)

			return nil
		},
	)
}
