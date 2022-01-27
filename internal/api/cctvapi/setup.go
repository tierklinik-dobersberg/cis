package cctvapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup adds all cctvapi routes to grp.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/cctv/camera
	ListCamerasEndpoint(router)

	// GET /api/cctv/camera/:camid/stream
	StreamCameraEndpoint(router)
}
