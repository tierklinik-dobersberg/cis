package customerapi

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/service/server"
)

// GetByIDEndpoint returns a JSON version of the customer
// with the given :id.
//
// GET /api/v1/customer/:id
func GetByIDEndpoint(grp gin.IRouter) {
	grp.GET("v1/:id", func(c *gin.Context) {
		ac := app.From(c)
		if ac == nil {
			return
		}

		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		customer, err := ac.Customers.CustomerByCID(c.Request.Context(), int(id))
		if err != nil {
			if errors.Is(err, customerdb.ErrNotFound) {
				server.AbortRequest(c, http.StatusNotFound, err)
			} else {
				server.AbortRequest(c, 0, err)
			}
			return
		}

		model := CustomerModel(c.Request.Context(), customer)
		c.JSON(http.StatusOK, model)
	})
}
