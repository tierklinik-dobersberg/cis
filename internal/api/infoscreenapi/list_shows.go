package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/infoscreen/v1alpha"
)

func ListShowsEndpoint(router *app.Router) {
	router.GET(
		"v1/shows",
		permission.OneOf{
			ActionShowsRead,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			shows, err := app.InfoScreenShows.ListShows(ctx)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, v1alpha.ListShowsResponse{
				Shows: shows,
			})
		},
	)
}
