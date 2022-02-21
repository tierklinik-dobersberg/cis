package rosterapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func DeleteOverwriteByIDEndpoint(router *app.Router) {
	router.DELETE(
		"v1/overwrite/:id",
		permission.OneOf{
			WriteRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			id := c.Param("id")

			if err := app.DutyRosters.DeleteOverwrite(ctx, id); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
