package voicemailapi

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func LoadRecordingEndpoint(router *app.Router) {
	router.GET(
		"v1/recording/:id",
		// FIXME(ppacher): anyone is not a good permission here!
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			id := c.Param("id")

			rec, err := app.VoiceMails.ByID(ctx, id)
			if err != nil {
				return err
			}

			f, err := os.Open(rec.Filename)
			if err != nil {
				return httperr.NotFound("recording", id, err)
			}
			defer f.Close()

			http.ServeContent(c.Writer, c.Request, rec.Filename, time.Now(), f)

			return nil
		},
	)
}
