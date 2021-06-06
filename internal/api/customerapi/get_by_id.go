package customerapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetByIDEndpoint returns a JSON version of the customer
// with the given :source/:id.
//
// GET /api/customer/v1/:source/:id
func GetByIDEndpoint(grp *app.Router) {
	grp.GET(
		"v1/:source/:id",
		permission.OneOf{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")

			if source != "vetinf" && source != "neumayr" {
				return httperr.InvalidParameter("source")
			}

			id, err := strconv.ParseInt(c.Param("id"), 10, 64)
			if err != nil {
				return httperr.InvalidParameter("id")
			}

			customer, err := app.Customers.CustomerByCID(ctx, source, int(id))
			if err != nil {
				return err
			}

			model := CustomerModel(ctx, customer)
			c.JSON(http.StatusOK, model)
			return nil
		},
	)
}
