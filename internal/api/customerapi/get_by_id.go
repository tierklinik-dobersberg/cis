package customerapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// GetByIDEndpoint returns a JSON version of the customer
// with the given :source/:id.
//
// GET /api/customer/v1/:source/:id.
func GetByIDEndpoint(grp *app.Router) {
	grp.GET(
		"v1/:source/:id",
		permission.OneOf{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")

			id := c.Param("id")
			customer, err := app.Customers.CustomerByCID(ctx, source, id)
			if err != nil {
				return err
			}

			model := CustomerModel(ctx, customer)
			c.JSON(http.StatusOK, model)
			return nil
		},
	)
}
