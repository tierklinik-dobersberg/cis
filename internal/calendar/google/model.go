package google

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	ciscal "github.com/tierklinik-dobersberg/cis/internal/calendar"
	"github.com/tierklinik-dobersberg/logger"
	"google.golang.org/api/calendar/v3"
)

func convertToEvent(ctx context.Context, calid string, item *calendar.Event) (*ciscal.Event, error) {
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

	newDescription, data, err := parseDescription(item.Description)
	if err != nil {
		log.From(ctx).Errorf("failed to parse calendar event meta data: %s", err)
	}
	if err == nil {
		item.Description = newDescription
	}

	return &ciscal.Event{
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

func parseDescription(desc string) (string, *ciscal.StructuredEvent, error) {
	allLines := strings.Split(desc, "\n")
	var (
		sectionLines      []string
		strippedDescr     string
		foundSectionStart bool
	)
	for idx, line := range allLines {
		line := strings.TrimSpace(line)
		if line == "[CIS]" {
			foundSectionStart = true
			sectionLines = allLines[idx:]
			strippedDescr = strings.TrimSpace(strings.Join(allLines[:idx], "\n"))
			break
		}
	}
	if !foundSectionStart {
		return "", nil, nil
	}

	reader := strings.NewReader(strings.Join(sectionLines, "\n"))
	f, err := conf.Deserialize("", reader)
	if err != nil {
		return "", nil, fmt.Errorf("failed to deserialize data section: %w", err)
	}

	var data ciscal.StructuredEvent
	if err := conf.DecodeSections(f.Sections, ciscal.StructuredEventSpec, &data); err != nil {
		return "", nil, fmt.Errorf("failed to decode structured event data: %w", err)
	}

	return strippedDescr, &data, nil
}
