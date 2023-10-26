package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func ListLayoutNamesEndpoint(router *app.Router) {
	router.GET(
		"v1/layouts",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			layouts, err := app.LayoutStore.ListNames(ctx)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, layouts)
		},
	)
}
