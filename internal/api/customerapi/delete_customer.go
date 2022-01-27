package customerapi

import (
	"context"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/logger"
)

func DeleteCustomerEndpoint(r *app.Router) {
	r.DELETE(
		"v1/:source/:id",
		permission.OneOf{
			DeleteCustomerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			source := c.Param("source")
			cid := c.Param("id")

			logger.From(ctx).WithFields(logger.Fields{
				"source": source,
				"cid":    cid,
			}).Infof("searching for customer, %+v, %+v", c.ParamNames(), c.ParamValues())
			cus, err := app.Customers.CustomerByCID(ctx, source, cid)
			if err != nil {
				return err
			}
			if err := customerdb.DefaultSourceManager.Delete(ctx, cus); err != nil {
				return err
			}
			if err := app.Customers.DeleteCustomer(ctx, cus.ID.Hex()); err != nil {
				return err
			}
			return nil
		},
	)
}
