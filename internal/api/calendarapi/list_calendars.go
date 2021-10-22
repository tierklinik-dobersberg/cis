package calendarapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
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
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			calendars, err := app.Calendar.ListCalendars(ctx)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, calendars)

			return nil
		},
	)
}
