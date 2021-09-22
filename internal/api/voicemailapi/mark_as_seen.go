package voicemailapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// MarkAsSeenEndpoint allows to mark voicemail records as seen.
func MarkAsSeenEndpoint(grp *app.Router) {
	grp.PUT(
		"v1/recording/:id/seen",
		permission.OneOf{ReadVoicemailsAction},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			id := c.Param("id")

			if err := app.VoiceMails.UpdateSeenFlag(ctx, id, true); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}
