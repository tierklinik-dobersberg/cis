package rosterapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/service/server"
)

func GetRosterEndpoint(grp gin.IRouter) {
	grp.GET("v1/:year/:month", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		month, year, ok := getYearAndMonth(c)
		if !ok {
			return
		}

		roster, err := app.DutyRosters.ForMonth(c.Request.Context(), month, year)
		if err != nil {
			if errors.Is(err, rosterdb.ErrNotFound) {
				server.AbortRequest(c, http.StatusNotFound, err)
				return
			}
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.JSON(http.StatusOK, roster)
	})
}
