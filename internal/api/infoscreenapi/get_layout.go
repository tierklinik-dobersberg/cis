package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func GetLayoutEndpoint(router *app.Router) {
	router.GET(
		"v1/layout/:layout",
		permission.OneOf{
			ActionLayoutRead,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			l, err := app.LayoutStore.Get(ctx, c.Param("layout"))
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, l)
			return nil
		},
	)
}
