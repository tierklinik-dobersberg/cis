package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListLayoutNamesEndpoint(router *app.Router) {
	router.GET(
		"v1/layouts",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			layouts, err := app.LayoutStore.ListNames(ctx)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, layouts)
			return nil
		},
	)
}
