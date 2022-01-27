package customerapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all API endpoints for the customer api.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/customer/v1/:source/:id
	GetByIDEndpoint(router)

	// DELETE /api/customer/v1/:source/:id
	DeleteCustomerEndpoint(router)

	// POST /api/customer/v1/search
	ExtendedSearchEndpoint(router)

	// GET /api/customer/v1?name=XXX
	FuzzySearchEndpoint(router)

	// GET /api/customer/sources/v1
	ListSourcesEndpoint(router)
}
