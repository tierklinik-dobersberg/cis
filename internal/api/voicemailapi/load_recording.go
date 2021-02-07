package voicemailapi

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func LoadRecordingEndpoint(router *app.Router) {
	router.GET(
		"v1/recording/:id",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			id := c.Param("id")

			rec, err := app.VoiceMails.ByID(ctx, id)
			if err != nil {
				return err
			}

			c.File(rec.Filename)
			return nil
		},
	)
}
