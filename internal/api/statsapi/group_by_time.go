package statsapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func GroupByOverTimeEndpoint(router *app.Router) {
	router.GET(
		"v1/:collection/group-by-time/:timeKey",
		simpleGroupByHandler,
	)
	router.GET(
		"v1/:collection/group-by-time/:timeKey/:groupKey",
		simpleGroupByHandler,
	)
}

func simpleGroupByHandler(ctx context.Context, app *app.App, c echo.Context) error {
	counterKey := c.QueryParam("count")
	stats, err := getStatsBuilder(c.Param("collection"), app)
	if err != nil {
		return err
	}

	groupByKey := c.Param("groupKey")
	timeKey := c.Param("timeKey")

	fromStr := c.QueryParam("from")
	if fromStr == "" {
		return httperr.MissingParameter("from")
	}
	from, err := app.ParseTime(time.RFC3339, fromStr)
	if err != nil {
		return httperr.InvalidParameter("from", err.Error())
	}

	toStr := c.QueryParam("to")
	if toStr == "" {
		return httperr.MissingParameter("to")
	}
	to, err := app.ParseTime(time.RFC3339, toStr)
	if err != nil {
		return httperr.InvalidParameter("to", err.Error())
	}
	timeRange := c.QueryParam("time-range")
	if timeRange == "" {
		timeRange = "day"
	}

	res, err := stats.SimpleGroupByOverTime(ctx, from, to, timeRange, groupByKey, timeKey, counterKey)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, res)
}
