package cctvapi

import (
	"github.com/labstack/echo/v4"
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
		func(c echo.Context) (string, error) {
			return c.Param("camera"), nil
		},
	)
)
