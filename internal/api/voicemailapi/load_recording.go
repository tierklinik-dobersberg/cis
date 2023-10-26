package voicemailapi

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// LoadRecordingEndpoint serves audio content of a voicemail
// recording.
func LoadRecordingEndpoint(router *app.Router) {
	router.GET(
		"v1/recording/:id",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			id := c.Param("id")

			rec, err := app.VoiceMails.ByID(ctx, id)
			if err != nil {
				return err
			}

			f, err := os.Open(rec.Filename)
			if err != nil {
				return httperr.NotFound("recording", id)
			}
			defer f.Close()

			http.ServeContent(c.Response(), c.Request(), rec.Filename, time.Now(), f)

			return nil
		},
	)
}
