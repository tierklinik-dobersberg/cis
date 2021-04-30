package calendar

import (
	"context"
	"time"
)

// Backend describes the methods each calendar backend must implement.
// A calendar backend should be capable of storing multiple calendars
// and events that belong to them.
type Backend interface {
	// ListCalendars lits all calendars available via the backend.
	ListCalendars(context.Context) ([]Calendar, error)
	// ListEvents should return a slice of events from calID that match the event search
	// opts.
	ListEvents(ctx context.Context, calID string, opts *EventSearchOptions) ([]Event, error)
	// CreateEvent creates a new event at the specified calID. Validation of the structured event
	// data must have been done already.
	CreateEvent(ctx context.Context, calID, name, description string, startTime time.Time, duration time.Duration, data *StructuredEvent) error
	// DeleteEvent deletes the event with the specified ID from calID.
	DeleteEvent(ctx context.Context, calID, eventid string) error
}
