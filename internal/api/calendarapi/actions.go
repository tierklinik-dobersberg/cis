package calendarapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	ReadEventsAction = permission.MustDefineAction(
		"calendar:events:read",
		"Permission required to read calendar events",
		nil,
	)
	WriteEventsAction = permission.MustDefineAction(
		"calendar:events:write",
		"Permission required to create or update calendar events",
		nil,
	)
	DeleteEventsAction = permission.MustDefineAction(
		"calendar:events:delete",
		"Permission required to delete calendar events",
		nil,
	)
)
