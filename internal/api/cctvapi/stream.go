package cctvapi

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// StreamCameraEndpoint streams the video of the camera
// to the caller.
func StreamCameraEndpoint(router *app.Router) {
	router.GET(
		"v1/camera/:camera/stream",
		permission.OneOf{
			WatchCameraStream,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			return app.CCTV.AttachToStream(ctx, c.Param("camera"), c)
		},
	)
}
