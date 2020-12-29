package doorapi

import "github.com/gin-gonic/gin"

// Setup registers all routes for the door controller.
func Setup(grp gin.IRouter) {
	TestStateEndpoint(grp)
	CurrentStateEndpoint(grp)
}
