package calendarapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// ListCalendarsEndpoint returns a list of all available
// and configured calendars. Calendars that are marked as
// hidden by the configuration are filtered and not returned
// to the caller.
func ListCalendarsEndpoint(router *app.Router) {
	router.GET(
		"v1/",
		permission.OneOf{
			ReadEventsAction, // TODO(ppacher): dedicated action?
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			calendars, err := app.Calendar.ListCalendars(ctx)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, calendars)
		},
	)
}
