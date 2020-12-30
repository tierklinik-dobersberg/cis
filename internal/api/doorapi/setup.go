package doorapi

import "github.com/gin-gonic/gin"

// Setup registers all routes for the door controller.
func Setup(grp gin.IRouter) {
	// GET /api/door/v1/test/:year/:month/:day/:hour/:minute
	TestStateEndpoint(grp)

	// GET /api/door/v1/state
	CurrentStateEndpoint(grp)

	// POST /api/door/v1/reset
	ResetDoorEndpoint(grp)

	// POST /api/door/v1/overwrite
	OverwriteEndpoint(grp)
}
