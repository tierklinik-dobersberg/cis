package calendarapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures all calendarpi routes
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/calendar/v1/events?for-day=2006-1-2&for-user=alice&for-user=bob
	ListEventsEndpoint(router)
}
