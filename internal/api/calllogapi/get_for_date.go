package calllogapi

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/service/server"
)

// ForDateEndpoint allows retrieving all calllogs for a given
// date.
func ForDateEndpoint(grp gin.IRouter) {
	grp.GET("v1/:year/:month/:day", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		year, err := strconv.ParseInt(c.Param("year"), 10, 0)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		month, err := strconv.ParseInt(c.Param("month"), 10, 0)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		day, err := strconv.ParseInt(c.Param("day"), 10, 0)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		d, err := time.Parse("2006-01-02", fmt.Sprintf("%04d-%02d-%02d", year, month, day))
		if err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		logs, err := app.CallLogs.ForDate(c.Request.Context(), d)
		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.JSON(http.StatusOK, logs)
	})
}
