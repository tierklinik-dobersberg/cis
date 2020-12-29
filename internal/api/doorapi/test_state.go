package doorapi

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/service/server"
)

func TestStateEndpoint(grp gin.IRouter) {
	grp.GET("v1/test/:year/:month/:day/:hour/:minute", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		year, ok := getIntParam("year", c)
		if !ok {
			return
		}
		month, ok := getIntParam("month", c)
		if !ok {
			return
		}
		day, ok := getIntParam("day", c)
		if !ok {
			return
		}
		hour, ok := getIntParam("hour", c)
		if !ok {
			return
		}
		minute, ok := getIntParam("minute", c)
		if !ok {
			return
		}

		date := time.Date(year, time.Month(month), day, hour, minute, 0, 0, time.Local)

		result, until := app.Door.StateFor(c.Request.Context(), date)
		c.JSON(http.StatusOK, gin.H{
			"desiredState": string(result),
			"until":        until.Format(time.RFC3339),
		})
	})
}

func getIntParam(name string, c *gin.Context) (int, bool) {
	stringValue := c.Param(name)

	// strip away the first leading zero if any
	if stringValue[0] == '0' {
		stringValue = stringValue[1:]
	}

	value, err := strconv.ParseInt(stringValue, 0, 64)
	if err != nil {
		server.AbortRequest(c, http.StatusBadRequest, err)
		return 0, false
	}

	return int(value), true
}
