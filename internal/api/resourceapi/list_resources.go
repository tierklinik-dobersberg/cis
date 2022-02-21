package resourceapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListResourcesEndpoint(router *app.Router) {
	router.GET(
		"v1/",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return c.JSON(
				http.StatusOK,
				app.Resources.List(),
			)
		},
	)
}
