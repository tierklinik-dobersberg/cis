package rosterapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/service/server"
)

func getYearAndMonth(c *gin.Context) (time.Month, int, bool) {
	yearStr := c.Param("year")
	monthStr := c.Param("month")
	monthStr = strings.TrimPrefix(monthStr, "0")

	year, err := strconv.ParseInt(yearStr, 10, 64)
	if err != nil {
		server.AbortRequest(c, http.StatusBadRequest, err)
		return 0, 0, false
	}

	month, err := strconv.ParseInt(monthStr, 10, 64)
	if err != nil {
		server.AbortRequest(c, http.StatusBadRequest, err)
		return 0, 0, false
	}

	if month < 1 || month > 12 {
		server.AbortRequest(c, http.StatusBadRequest, errors.New("invalid month"))
		return 0, 0, false
	}

	return time.Month(month), int(year), true
}
