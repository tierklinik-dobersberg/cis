package customerapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
)

// ExtendedSearchEndpoint searches for one or more customers
// that match a given criteria.
//
// WARNING: this endpoint gives direct FindMany access to the
// mongodb collection! Make sure users are properly authenticated!
//
// POST /api/v1/customer/search.
func ExtendedSearchEndpoint(grp *app.Router) {
	grp.POST(
		"v1/search",
		permission.OneOf{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var result map[string]interface{}

			if err := json.NewDecoder(c.Request().Body).Decode(&result); err != nil {
				return httperr.BadRequest("invalid body").SetInternal(err)
			}

			customers, err := app.Customers.FilterCustomer(ctx, result, false)
			if err != nil {
				return err
			}

			models := make([]*v1.Customer, len(customers))
			for idx, cu := range customers {
				m := CustomerModel(ctx, cu)
				models[idx] = m
			}

			c.JSON(http.StatusOK, models)
			return nil
		},
	)
}
