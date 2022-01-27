package calendarapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures all calendarpi routes.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/calendar/v1/
	ListCalendarsEndpoint(router)

	// GET /api/calendar/v1/events?for-day=2006-1-2&for-user=alice&for-user=bob
	ListEventsEndpoint(router)

	// POST /api/calendar/v1/events
	CreateEventEndpoint(router)

	// DELETE /api/calendar/v1/events/:calid/:id
	DeleteEventEndpoint(router)
}
