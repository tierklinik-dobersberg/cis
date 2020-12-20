package rosterapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

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

		yearStr := c.Param("year")
		monthStr := c.Param("month")
		monthStr = strings.TrimPrefix(monthStr, "0")

		year, err := strconv.ParseInt(yearStr, 10, 64)
		if err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		month, err := strconv.ParseInt(monthStr, 10, 64)
		if err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		if month < 1 || month > 10 {
			server.AbortRequest(c, http.StatusBadRequest, errors.New("invalid month"))
			return
		}

		roster, err := app.DutyRosters.ForMonth(c.Request.Context(), time.Month(month), int(year))
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
