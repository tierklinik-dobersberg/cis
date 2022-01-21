package statsapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func GroupByEndpoint(router *app.Router) {
	router.GET(
		"v1/:collection/group-by/:key",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			counterKey := c.Query("count")
			stats, err := getStatsBuilder(c.Param("collection"), app)
			if err != nil {
				return err
			}

			groupByKey := c.Param("key")

			res, err := stats.SimpleGroupBy(ctx, groupByKey, counterKey)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, res)
			return nil
		},
	)
}
