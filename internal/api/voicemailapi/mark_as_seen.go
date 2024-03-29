package voicemailapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// MarkAsSeenEndpoint allows to mark voicemail records as seen.
func MarkAsSeenEndpoint(grp *app.Router) {
	grp.PUT(
		"v1/recording/:id/seen",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			id := c.Param("id")

			if err := app.VoiceMails.UpdateSeenFlag(ctx, id, true); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
