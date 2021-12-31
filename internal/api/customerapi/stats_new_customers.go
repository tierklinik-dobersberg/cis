package customerapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func NewCustomerStatsEndpoint(router *app.Router) {
	router.GET(
		"v1/stats/new-customers",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
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

			res, err := app.Customers.Stats().NewCustomers(ctx, from, to, timeRange)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, res)

			return nil
		},
	)
}
