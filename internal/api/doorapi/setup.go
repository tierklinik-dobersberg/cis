package doorapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all routes for the door controller.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/door/v1/test/:year/:month/:day/:hour/:minute
	TestStateEndpoint(router)

	// GET /api/door/v1/state
	CurrentStateEndpoint(router)

	// POST /api/door/v1/reset
	ResetDoorEndpoint(router)

	// POST /api/door/v1/overwrite
	OverwriteEndpoint(router)
}
