package statsapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func GroupByEndpoint(router *app.Router) {
	router.GET(
		"v1/:collection/group-by/:key",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			counterKey := c.QueryParam("count")
			stats, err := getStatsBuilder(c.Param("collection"), app)
			if err != nil {
				return err
			}

			groupByKey := c.Param("key")

			res, err := stats.SimpleGroupBy(ctx, groupByKey, counterKey)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, res)
		},
	)
}
