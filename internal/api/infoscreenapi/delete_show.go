package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func DeleteShowEndpoint(router *app.Router) {
	router.DELETE(
		"v1/shows/:show",
		permission.OneOf{
			ActionShowsDelete,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			showName := c.Param("show")

			if err := app.InfoScreenShows.DeleteShow(ctx, showName); err != nil {
				return err
			}

			return c.NoContent(http.StatusAccepted)
		},
	)
}
