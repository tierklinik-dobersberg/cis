package calllogapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures the calllog API endpoints.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/calllogs/v1/date/:year/:month/:day
	ForDateEndpoint(router)

	// GET /api/calllogs/v1/customer/:source/:id
	ForCustomerEndpoint(router)
}
