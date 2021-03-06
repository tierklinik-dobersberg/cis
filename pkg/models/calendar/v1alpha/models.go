package v1alpha

import (
	"github.com/tierklinik-dobersberg/cis/internal/calendar"
)

type Event struct {
	calendar.Event
	Username     string `json:"username,omitempty"`
	CalendarName string `json:"calendarName,omitempty"`
}

type CreateEventCall struct {
	Event
	// Duration is the duration of the event. May be set
	// instead of EndTime.
	Duration string `json:"duration,omitempty"`
}
