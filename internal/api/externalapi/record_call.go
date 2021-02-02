package externalapi

import (
	"context"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

// RecordCallEndpoint allows to record an incoming phone call in the calllog.
func RecordCallEndpoint(grp *app.Router) {
	grp.POST(
		"v1/calllog",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			caller := c.Query("ani")
			did := c.Query("did")

			reqBlob, err := httputil.DumpRequest(c.Request, true)
			if err != nil {
				logger.Errorf(ctx, "failed to dump request: %s", err)
			}
			if err := ioutil.WriteFile("/log/record-call-request.dump", reqBlob, 0700); err != nil {
				logger.Errorf(ctx, "failed to dump request: %s", err)
			}

			if err := app.CallLogs.Create(ctx, time.Now(), caller, did); err != nil {
				return httperr.InternalError(err)
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
