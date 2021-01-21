package customerapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all API endpoints for the customer api.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/customer/v1/:id
	GetByIDEndpoint(router)

	// POST /api/customer/v1/search
	ExtendedSearchEndpoint(router)

	// GET /api/customer/v1?name=XXX
	FuzzySearchEndpoint(router)
}
