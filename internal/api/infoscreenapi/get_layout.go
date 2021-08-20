package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func GetLayoutEndpoint(router *app.Router) {
	router.GET(
		"v1/layout/:layout",
		permission.OneOf{
			ActionShowsWrite,
			ActionShowsRead,
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

	router.GET(
		"v1/layout/:layout/icon",
		permission.OneOf{
			ActionShowsRead,
			ActionShowsWrite,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			layoutName := c.Param("layout")
			l, err := app.LayoutStore.Get(ctx, layoutName)
			if err != nil {
				return err
			}

			if l.PreviewIcon == "" {
				return httperr.NotFound("layout icon", layoutName, nil)
			}

			iconPath := l.FilePath(l.PreviewIcon)

			http.ServeFile(c.Writer, c.Request, iconPath)
			return nil
		},
	)
}
