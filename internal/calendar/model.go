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

	data, err := parseDescription(item.Description)
	if err != nil {
		log.From(ctx).Errorf("failed to parse calendar event meta data: %s", err)
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

func parseDescription(desc string) (*StructuredEvent, error) {
	lines := strings.Split(desc, "\n")
	foundSectionStart := false
	for idx, line := range lines {
		line := strings.TrimSpace(line)
		if line == "[CIS]" {
			foundSectionStart = true
			lines = lines[idx:]
			break
		}
	}
	if !foundSectionStart {
		return nil, nil
	}

	reader := strings.NewReader(strings.Join(lines, "\n"))
	f, err := conf.Deserialize("", reader)
	if err != nil {
		return nil, err
	}

	var data StructuredEvent
	if err := conf.DecodeSections(f.Sections, StructuredEventSpec, &data); err != nil {
		return nil, err
	}

	return &data, nil
}
