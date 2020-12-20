package customerapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/service/server"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
func FuzzySearchEndpoint(grp gin.IRouter) {
	grp.GET("v1/", func(c *gin.Context) {
		ac := app.From(c)
		if ac == nil {
			return
		}

		name := c.Query("name")

		customers, err := ac.Customers.FuzzySearchName(c.Request.Context(), name)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		models := make([]*v1.Customer, len(customers))
		for idx, cu := range customers {
			m := CustomerModel(c.Request.Context(), cu)
			models[idx] = m
		}

		c.JSON(http.StatusOK, models)
	})
}
