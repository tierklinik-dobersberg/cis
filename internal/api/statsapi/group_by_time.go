package statsapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func GroupByOverTimeEndpoint(router *app.Router) {
	router.GET(
		"v1/:collection/group-by-time/:timeKey",
		permission.Anyone,
		simpleGroupByHandler,
	)
	router.GET(
		"v1/:collection/group-by-time/:timeKey/:groupKey",
		permission.Anyone,
		simpleGroupByHandler,
	)
}

func simpleGroupByHandler(ctx context.Context, app *app.App, c *gin.Context) error {
	counterKey := c.Query("count")
	stats, err := getStatsBuilder(c.Param("collection"), app)
	if err != nil {
		return err
	}

	groupByKey := c.Param("groupKey")
	timeKey := c.Param("timeKey")

	fromStr, ok := c.GetQuery("from")
	if !ok {
		return httperr.MissingParameter("from")
	}
	from, err := app.ParseTime(time.RFC3339, fromStr)
	if err != nil {
		return httperr.InvalidParameter("from", err.Error())
	}

	toStr, ok := c.GetQuery("to")
	if !ok {
		return httperr.MissingParameter("to")
	}
	to, err := app.ParseTime(time.RFC3339, toStr)
	if err != nil {
		return httperr.InvalidParameter("to", err.Error())
	}
	timeRange, ok := c.GetQuery("time-range")
	if !ok {
		timeRange = "daily"
	}

	res, err := stats.SimpleGroupByOverTime(ctx, from, to, timeRange, groupByKey, timeKey, counterKey)
	if err != nil {
		return err
	}

	c.JSON(http.StatusOK, res)

	return nil
}
