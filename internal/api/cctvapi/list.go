package cctvapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListCamerasEndpoint(router *app.Router) {
	router.GET(
		"v1/cameras",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			c.JSON(http.StatusOK, app.CCTV.ListDefinitions())
			return nil
		},
	)
}
