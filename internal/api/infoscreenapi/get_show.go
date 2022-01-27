package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func GetShowEndpoint(router *app.Router) {
	router.GET(
		"v1/shows/:show",
		permission.OneOf{
			ActionShowsRead,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			showName := c.Param("show")
			s, err := app.InfoScreenShows.GetShow(ctx, showName)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, s)
			return nil
		},
	)
}
