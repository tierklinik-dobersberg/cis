package customerapi

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func DeleteCustomerEndpoint(r *app.Router) {
	r.DELETE(
		"v1/:source/:cid",
		permission.OneOf{
			DeleteCustomerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")
			cid := c.Param("cid")

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
