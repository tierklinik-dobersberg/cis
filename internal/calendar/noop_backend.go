package calendar

import (
	"context"
	"errors"
	"time"
)

var ErrCalendarDisabled = errors.New("google calendar integration is disabled")

type noopBackend struct {
}

func (*noopBackend) ListCalendars(ctx context.Context) ([]Calendar, error) {
	return nil, ErrCalendarDisabled
}

func (*noopBackend) ListEvents(ctx context.Context, calendarID string, filter *EventSearchOptions) ([]Event, error) {
	return nil, ErrCalendarDisabled
}

func (*noopBackend) CreateEvent(ctx context.Context, calId, name, description string, startTime time.Time, duration time.Duration, data *StructuredEvent) error {
	return ErrCalendarDisabled
}

func (*noopBackend) DeleteEvent(ctx context.Context, calID, eventId string) error {
	return ErrCalendarDisabled
}
