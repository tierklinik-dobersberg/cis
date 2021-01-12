package rosterapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/service/server"
)

// DeleteRosterEndpoint provides a HTTP endpoint to delete the
// duty roster of a single month.
func DeleteRosterEndpoint(grp gin.IRouter) {
	grp.DELETE("v1/:year/:month", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		month, year, ok := getYearAndMonth(c)
		if !ok {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}

		if err := app.DutyRosters.Delete(c.Request.Context(), month, year); err != nil {
			if errors.Is(err, rosterdb.ErrNotFound) {
				c.AbortWithStatus(http.StatusNotFound)
				return
			}

			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.Status(http.StatusGone)
	})
}
