package rosterapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetActiveOverwriteEndpoint returns the duty-roster overwrite for the
// requested day.
func GetActiveOverwriteEndpoint(router *app.Router) {
	router.GET(
		"v1/overwrite",
		permission.OneOf{
			ReadRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			date := c.QueryParam("date")

			var d time.Time = time.Now()
			if date != "" {
				var err error
				d, err = app.ParseTime(time.RFC3339, date)
				if err != nil {
					return httperr.InvalidParameter("date", err.Error())
				}
			}

			overwrite, err := app.DutyRosters.GetActiveOverwrite(ctx, d)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, overwrite)
		},
	)
}
