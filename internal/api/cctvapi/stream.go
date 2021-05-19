package cctvapi

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func StreamCameraEndpoint(router *app.Router) {
	router.GET(
		"v1/camera/:camera/stream",
		permission.Anyone, // FIXME(ppacher),
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			return app.CCTV.AttachToStream(ctx, c.Param("camera"), c)
		},
	)
}
