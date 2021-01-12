package externalapi

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/service/server"
)

// RecordCallEndpoint allows to record an incoming phone call in the calllog.
func RecordCallEndpoint(grp gin.IRouter) {
	grp.POST("v1/calllog", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		caller := c.Query("ani")
		did := c.Query("did")

		if err := app.CallLogs.Create(c.Request.Context(), time.Now(), caller, did); err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.Status(http.StatusNoContent)
	})
}
