package calllogapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures the calllog API endpoints.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/calllogs/v1/date/:year/:month/:day
	ForDateEndpoint(router)

	// GET /api/callogs/v1/search
	SearchEndpoint(router)

	// GET /api/calllogs/v1/customer/:source/:id
	ForCustomerEndpoint(router)
}
