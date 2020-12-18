package customerapi

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/service/server"
)

// SearchCustomerEndpoint searches for one or more customers
// that match a given criteria.
//
// WARNING: this endpoint gives direct FindMany access to the
// mongodb collection! Make sure users are properly authenticated!
//
// POST /api/v1/customer/search
func SearchCustomerEndpoint(grp gin.IRouter) {
	grp.POST("v1/customer/search", func(c *gin.Context) {
		ac := app.From(c)
		if ac == nil {
			return
		}

		var result map[string]interface{}

		if err := json.NewDecoder(c.Request.Body).Decode(&result); err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		customers, err := ac.Customers.FilterCustomer(c.Request.Context(), result)
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
