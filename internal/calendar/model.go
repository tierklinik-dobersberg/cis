package calendar

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
	"google.golang.org/api/calendar/v3"
)

func convertToEvent(ctx context.Context, calid string, item *calendar.Event) (*Event, error) {
	var (
		err   error
		start time.Time
		end   *time.Time
		data  *StructuredEvent
	)

	if item == nil {
		return nil, fmt.Errorf("received nil item")
	}

	if item.Start == nil {
		log.From(ctx).WithFields(logger.Fields{
			"event": item,
		}).Errorf("failed to process google calendar event: event.Start == nil")

		return nil, fmt.Errorf("event with ID %s does not have start time", item.Id)
	}

	if item.Start.DateTime != "" {
		start, err = time.Parse(time.RFC3339, item.Start.DateTime)
	} else {
		start, err = time.Parse("2006-01-02", item.Start.Date)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to parse event start time: %s", err)
	}

	if !item.EndTimeUnspecified {
		var t time.Time
		if item.End.DateTime != "" {
			t, err = time.Parse(time.RFC3339, item.End.DateTime)
		} else {
			t, err = time.Parse("2006-01-02", item.End.Date)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to parse event end time: %s", err)
		}
		end = &t
	}

	// TODO(ppacher): add support for freeform text in the description
	// as well by using something like YAML frontmatter
	if item.Description != "" {
		reader := strings.NewReader(item.Description)
		f, err := conf.Deserialize("", reader)
		// TODO(ppacher): we could be more strict here
		if err == nil && f.Sections.Has("CIS") {
			data = new(StructuredEvent)
			err = conf.DecodeSections(f.Sections, StructuredEventSpec, data)
		}

		if err != nil {
			// only log on trace level because we expect this to happen
			// a lot
			log.From(ctx).V(7).Logf("failed to parse description: %s", err)
			data = nil
		}
	}

	return &Event{
		ID:           item.Id,
		Summary:      strings.TrimSpace(item.Summary),
		Description:  strings.TrimSpace(item.Description),
		StartTime:    start,
		EndTime:      end,
		FullDayEvent: item.Start.DateTime == "" && item.Start.Date != "",
		CalendarID:   calid,
		Data:         data,
	}, nil
}
