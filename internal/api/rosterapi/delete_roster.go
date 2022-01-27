package rosterapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// DeleteRosterEndpoint provides a HTTP endpoint to delete the
// duty roster of a single month.
func DeleteRosterEndpoint(grp *app.Router) {
	grp.DELETE(
		"v1/roster/:year/:month",
		permission.OneOf{
			WriteRosterAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			month, year, err := getYearAndMonth(c)
			if err != nil {
				return err
			}

			if err := app.DutyRosters.Delete(ctx, month, year); err != nil {
				return err
			}

			c.NoContent(http.StatusAccepted)
			return nil
		},
	)
}
