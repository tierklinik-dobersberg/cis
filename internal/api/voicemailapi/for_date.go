package voicemailapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
)

// ForDateEndpoints allows loading voicemail records for a given date.
func ForDateEndpoints(router *app.Router) {
	router.GET(
		"v1/search",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			name := c.Query("name")
			date := c.Query("date")

			d, err := time.ParseInLocation("2006-1-2", date, app.Location())
			if err != nil {
				return httperr.BadRequest(err, "invalid date")
			}

			records, err := app.VoiceMails.ForDate(ctx, name, d)
			if err != nil {
				return httperr.InternalError(err)
			}

			c.JSON(http.StatusOK, records)

			return nil
		},
	)
}
