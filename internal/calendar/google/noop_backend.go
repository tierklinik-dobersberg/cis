package google

import (
	"context"
	"errors"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/calendar"
)

var ErrCalendarDisabled = errors.New("google calendar integration is disabled")

type noopBackend struct {
}

func (*noopBackend) ListCalendars(ctx context.Context) ([]calendar.Calendar, error) {
	return nil, ErrCalendarDisabled
}

func (*noopBackend) ListEvents(ctx context.Context, calendarID string, filter *calendar.EventSearchOptions) ([]calendar.Event, error) {
	return nil, ErrCalendarDisabled
}

func (*noopBackend) CreateEvent(ctx context.Context, calID, name, description string, startTime time.Time, duration time.Duration, data *calendar.StructuredEvent) error {
	return ErrCalendarDisabled
}

func (*noopBackend) DeleteEvent(ctx context.Context, calID, eventID string) error {
	return ErrCalendarDisabled
}
