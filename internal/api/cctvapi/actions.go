package cctvapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// Permissions defined by the cctvapi:.
var (
	ReadCameraAction = permission.MustDefineAction(
		"camera:read",
		"Permission required to read registered cameras",
		nil,
	)
	WatchCameraStream = permission.MustDefineAction(
		"camera:watch",
		"Permission required to watch camera streams",
		func(c *gin.Context) (string, error) {
			return c.Param("camera"), nil
		},
	)
)
