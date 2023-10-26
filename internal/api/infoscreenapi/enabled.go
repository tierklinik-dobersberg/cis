package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func EnabledEndpoint(router *app.Router) {
	router.GET(
		"v1",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return c.JSON(http.StatusOK, gin.H{
				"enabled": app.Config.InfoScreenConfig.Enabled,
			})
		},
	)
}
