package rosterapi

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func getYearAndMonth(c *gin.Context) (time.Month, int, error) {
	yearStr := c.Param("year")
	monthStr := c.Param("month")
	monthStr = strings.TrimPrefix(monthStr, "0")

	year, err := strconv.ParseInt(yearStr, 10, 0)
	if err != nil {
		return 0, 0, httperr.InvalidParameter("year", err.Error())
	}

	month, err := strconv.ParseInt(monthStr, 10, 0)
	if err != nil {
		return 0, 0, httperr.InvalidParameter("month", err.Error())
	}

	if month < 1 || month > 12 {
		return 0, 0, httperr.InvalidParameter("month", err.Error())
	}

	return time.Month(month), int(year), nil
}
