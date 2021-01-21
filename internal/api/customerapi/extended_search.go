package customerapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
)

// ExtendedSearchEndpoint searches for one or more customers
// that match a given criteria.
//
// WARNING: this endpoint gives direct FindMany access to the
// mongodb collection! Make sure users are properly authenticated!
//
// POST /api/v1/customer/search
func ExtendedSearchEndpoint(grp *app.Router) {
	grp.POST(
		"v1/search",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			var result map[string]interface{}

			if err := json.NewDecoder(c.Request.Body).Decode(&result); err != nil {
				return httperr.BadRequest(err, "invalid body")
			}

			customers, err := app.Customers.FilterCustomer(ctx, result)
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
