package configapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures all endpoints for the configapi.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/config/v1/ui
	GetUIConfigEndpoint(router)

	// GET /api/config/v1/schemas
	ListSchemasEndpoint(router)

	// GET /api/config/v1/schema/:key
	GetConfigsEndpoint(router)

	// POST /api/config/v1/schema/:key
	CreateConfigEndpoint(router)

	// GET /api/config/v1/schema/:key/:id
	GetConfigByIDEndpoint(router)

	// PATCH /api/config/v1/schema/:key/:id
	PatchConfigEndpoint(router)

	// DELETE /api/config/v1/schema/:key/:id
	DeleteConfigEndpoint(router)
}
