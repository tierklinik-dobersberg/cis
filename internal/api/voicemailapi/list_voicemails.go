package voicemailapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/voicemail"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

// ListMailboxesEndpoint returns a list of all configured voice-
// mail endpoints.
func ListMailboxesEndpoint(router *app.Router) {
	router.GET(
		"v1/list",
		permission.OneOf{ReadVoicemailsAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var voicemails []voicemail.Definition

			if err := runtime.GlobalSchema.DecodeSection(ctx, "VoiceMail", &voicemails); err != nil {
				return err
			}

			names := make([]string, len(voicemails))

			for idx, cfg := range voicemails {
				names[idx] = cfg.Name
			}

			return c.JSON(http.StatusOK, names)
		},
	)
}
