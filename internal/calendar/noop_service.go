package calendar

import (
	"context"
	"errors"
	"time"
)

var ErrCalendarDisabled = errors.New("google calendar integration is disabled")

type noopService struct {
}

func (*noopService) ListCalendars(ctx context.Context) ([]Calendar, error) {
	return nil, ErrCalendarDisabled
}

func (*noopService) ListEvents(ctx context.Context, calendarID string, filter *EventSearchOptions) ([]Event, error) {
	return nil, ErrCalendarDisabled
}

func (*noopService) CreateEvent(ctx context.Context, calId, name, description string, startTime time.Time, duration time.Duration, data *StructuredEvent) error {
	return ErrCalendarDisabled
}

func (*noopService) DeleteEvent(ctx context.Context, calID, eventId string) error {
	return ErrCalendarDisabled
}
