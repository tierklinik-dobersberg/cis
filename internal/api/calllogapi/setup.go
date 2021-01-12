package calllogapi

import "github.com/gin-gonic/gin"

// Setup configures the calllog API endpoints.
func Setup(grp gin.IRouter) {
	// GET /api/calllogs/v1/:year/:month/:day
	ForDateEndpoint(grp)
}
