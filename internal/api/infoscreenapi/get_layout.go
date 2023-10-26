package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func GetLayoutEndpoint(router *app.Router) {
	router.GET(
		"v1/layout/:layout",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			l, err := app.LayoutStore.Get(ctx, c.Param("layout"))
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, l)
		},
	)

	router.GET(
		"v1/layout/:layout/icon",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			layoutName := c.Param("layout")
			l, err := app.LayoutStore.Get(ctx, layoutName)
			if err != nil {
				return err
			}

			if l.PreviewIcon == "" {
				return httperr.NotFound("layout icon", layoutName)
			}

			iconPath := l.FilePath(l.PreviewIcon)

			return c.File(iconPath)
		},
	)
}
