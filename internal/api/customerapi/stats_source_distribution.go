package customerapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func CustomerSourceDistributionEndpoint(router *app.Router) {
	router.GET(
		"v1/stats/source-distribution",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			res, err := app.Customers.Stats().CustomerSourceDistribution(ctx)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, res)
			return nil
		},
	)
}
