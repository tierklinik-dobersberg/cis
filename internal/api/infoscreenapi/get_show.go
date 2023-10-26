package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func GetShowEndpoint(router *app.Router) {
	router.GET(
		"v1/shows/:show",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			showName := c.Param("show")
			s, err := app.InfoScreenShows.GetShow(ctx, showName)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, s)
		},
	)
}
