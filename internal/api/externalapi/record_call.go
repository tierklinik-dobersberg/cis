package externalapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
)

// RecordCallEndpoint allows to record an incoming phone call in the calllog.
func RecordCallEndpoint(grp *app.Router) {
	grp.POST(
		"v1/calllog",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			caller := c.Query("ani")
			did := c.Query("did")

			if err := app.CallLogs.Create(ctx, time.Now(), caller, did); err != nil {
				return httperr.InternalError(err)
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
