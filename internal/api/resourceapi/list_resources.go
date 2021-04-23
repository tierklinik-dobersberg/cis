package resourceapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListResourcesEndpoint(router *app.Router) {
	router.GET(
		"v1/",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			c.JSON(
				http.StatusOK,
				app.Resources.List(),
			)
			return nil
		},
	)
}
