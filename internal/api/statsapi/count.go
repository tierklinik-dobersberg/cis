package statsapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func CountEndpoint(router *app.Router) {
	router.GET(
		"v1/:collection/count/:key",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			stats, err := getStatsBuilder(c.Param("collection"), app)
			if err != nil {
				return err
			}

			counter := c.Param("key")
			res, err := stats.SimpleCount(ctx, counter)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, res)
		},
	)
}
