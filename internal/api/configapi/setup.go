package configapi

import "github.com/gin-gonic/gin"

// Setup configures all endpoints for the configapi.
func Setup(grp gin.IRouter) {
	// GET /api/config/v1/ui
	GetUIConfigEndpoint(grp)
}
