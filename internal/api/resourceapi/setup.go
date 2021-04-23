package resourceapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup creates all resource endpoints
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/resources/v1
	ListResourcesEndpoint(router)
}
