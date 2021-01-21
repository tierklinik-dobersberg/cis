package customerapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
func FuzzySearchEndpoint(grp *app.Router) {
	grp.GET(
		"v1/",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			name := c.Query("name")

			customers, err := app.Customers.FuzzySearchName(ctx, name)
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
