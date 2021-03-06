package voicemailapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func MarkAsUnseenEndpoint(grp *app.Router) {
	grp.DELETE(
		"v1/recording/:id/seen",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			id := c.Param("id")

			if err := app.VoiceMails.UpdateSeenFlag(ctx, id, false); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}
