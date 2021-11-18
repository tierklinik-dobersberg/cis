package cctvapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup adds all cctvapi routes to grp.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/cctv/camera
	ListCamerasEndpoint(router)

	// GET /api/cctv/camera/:camid/stream
	StreamCameraEndpoint(router)
}
