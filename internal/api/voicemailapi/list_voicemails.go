package voicemailapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// ListMailboxesEndpoint returns a list of all configured voice-
// mail endpoints.
func ListMailboxesEndpoint(router *app.Router) {
	router.GET(
		"v1/list",
		permission.OneOf{ReadVoicemailsAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			names := make([]string, len(app.Config.VoiceMails))

			for idx, cfg := range app.Config.VoiceMails {
				names[idx] = cfg.Name
			}

			c.JSON(http.StatusOK, names)
			return nil
		},
	)
}
