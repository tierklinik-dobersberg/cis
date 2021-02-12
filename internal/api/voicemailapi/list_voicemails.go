package voicemailapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListMailboxes(router *app.Router) {
	router.GET(
		"v1/list",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			names := make([]string, len(app.Config.VoiceMails))

			for idx, cfg := range app.Config.VoiceMails {
				names[idx] = cfg.Name
			}

			c.JSON(http.StatusOK, names)
			return nil
		},
	)
}
