package voicemailapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// MarkAsUnseenEndpoint allows to mark voicemail records as
// unseen.
func MarkAsUnseenEndpoint(grp *app.Router) {
	grp.DELETE(
		"v1/recording/:id/seen",
		permission.OneOf{ReadVoicemailsAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			id := c.Param("id")

			if err := app.VoiceMails.UpdateSeenFlag(ctx, id, false); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
