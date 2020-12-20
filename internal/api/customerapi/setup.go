package customerapi

import "github.com/gin-gonic/gin"

// Setup registers all API endpoints for the customer api.
func Setup(grp gin.IRouter) {
	// GET /api/customer/v1/:id
	GetByIDEndpoint(grp)

	// POST /api/customer/v1/search
	ExtendedSearchEndpoint(grp)

	// GET /api/customer/v1?name=XXX
	FuzzySearchEndpoint(grp)
}
