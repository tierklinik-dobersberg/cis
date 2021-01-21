package configapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures all endpoints for the configapi.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/config/v1/ui
	GetUIConfigEndpoint(router)
}
