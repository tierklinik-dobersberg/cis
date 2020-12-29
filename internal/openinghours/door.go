package openinghours

// TODO(ppacher): move all the parsing work away from this package to schema or utils.

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/logger"
)

// DoorState describes the current state of the entry door.
type DoorState string

// Possible door states
const (
	Locked   = DoorState("locked")
	Unlocked = DoorState("unlocked")
)

// DoorController interacts with the entry door controller via MQTT.
type DoorController struct {
	holidays HolidayGetter
	country  string

	// regularOpeningHours holds all regular opening hours.
	regularOpeningHours map[time.Weekday][]OpeningHour

	// dateSpecificHours contains opening hours that are used
	// instead of the regular opening hours at special days
	// during the year (like unofficial holidays or as a holiday
	// overwrite). The map key has the format "MM/DD".
	dateSpecificHours map[string][]OpeningHour

	// holidayTimeRanges specifies the opening hours during
	// public holidays.
	holidayTimeRanges []OpeningHour
}

// NewDoorController returns a new door controller.
func NewDoorController(cfg schema.Config, timeRanges []schema.OpeningHours, holidays HolidayGetter) (*DoorController, error) {
	dc := &DoorController{
		country:             cfg.Country,
		holidays:            holidays,
		regularOpeningHours: make(map[time.Weekday][]OpeningHour),
		dateSpecificHours:   make(map[string][]OpeningHour),
	}

	var (
		defaultOpenBefore time.Duration
		defaultCloseAfter time.Duration
		err               error
	)

	if cfg.DefaultCloseAfter != "" {
		defaultCloseAfter, err = time.ParseDuration(cfg.DefaultCloseAfter)
		if err != nil {
			return nil, fmt.Errorf("invalid setting for DefaultCloseAfter= stanza: %w", err)
		}
	}

	if cfg.DefaultOpenBefore != "" {
		defaultOpenBefore, err = time.ParseDuration(cfg.DefaultOpenBefore)
		if err != nil {
			return nil, fmt.Errorf("invalid setting for DefaultOpenBefore= stanza: %w", err)
		}
	}

	for _, c := range timeRanges {
		var (
			days       []time.Weekday
			dates      []string
			openBefore time.Duration
			closeAfter time.Duration
			err        error
		)

		if c.OpenBefore != "" {
			openBefore, err = time.ParseDuration(c.OpenBefore)
			if err != nil {
				return nil, fmt.Errorf("invalid OpenBefore= stanza: %w", err)
			}
		} else {
			openBefore = defaultOpenBefore
		}

		if c.CloseAfter != "" {
			closeAfter, err = time.ParseDuration(c.CloseAfter)
			if err != nil {
				return nil, fmt.Errorf("invalid CloseAfter= stanza: %w", err)
			}
		} else {
			closeAfter = defaultCloseAfter
		}

		for _, d := range c.OnWeekday {
			if err := schema.ValidDay(d); err != nil {
				return nil, err
			}

			parsed, ok := schema.ParseDay(d)
			if !ok {
				return nil, fmt.Errorf("failed to parse day: %s", d)
			}

			days = append(days, parsed)
		}

		for _, d := range c.UseAtDate {
			parts := strings.Split(d, "/")
			if len(parts) != 2 {
				return nil, fmt.Errorf("invalid date: %q", d)
			}

			month, err := strconv.ParseInt(strings.TrimLeft(parts[0], "0"), 0, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid date: %q: %w", d, err)
			}
			if month < 0 || month > 12 {
				return nil, fmt.Errorf("invalid month: %d", month)
			}

			day, err := strconv.ParseInt(strings.TrimLeft(parts[1], "0"), 0, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid date: %q: %w", d, err)
			}
			if day < 0 || day > 31 {
				return nil, fmt.Errorf("invalid day: %d", day)
			}

			dates = append(dates, fmt.Sprintf("%02d/%02d", month, day))
		}

		var ranges []OpeningHour
		for _, r := range c.TimeRanges {
			tr, err := utils.ParseDayTimeRange(r)
			if err != nil {
				return nil, err
			}

			ranges = append(ranges, OpeningHour{
				DayTimeRange: tr,
				CloseAfter:   closeAfter,
				OpenBefore:   openBefore,
			})
		}

		holiday := strings.ToLower(c.Holiday)

		// if its a setting for holidays as well (or holidays only)
		// add it to the correct slice.
		if holiday == "yes" || holiday == "only" {
			dc.holidayTimeRanges = append(dc.holidayTimeRanges, ranges...)
		}

		// if it's not for holidays only we need to add it to the regular
		// hours as well
		if holiday != "only" {
			for _, d := range days {
				dc.regularOpeningHours[d] = append(dc.regularOpeningHours[d], ranges...)
			}
		} else if len(days) > 0 {
			return nil, fmt.Errorf("Days= stanza not allowed with Holiday=only")
		}

		// regardless of the holiday setting it's always possible to directly set
		// the hours for specific dates
		for _, d := range dates {
			dc.dateSpecificHours[d] = append(dc.dateSpecificHours[d], ranges...)
		}
	}

	// finally, sort all opening hours and make sure we don't have overlapping ones

	for k := range dc.regularOpeningHours {
		if err := sortAndValidate(dc.regularOpeningHours[k]); err != nil {
			return nil, err
		}
	}
	for k := range dc.dateSpecificHours {
		if err := sortAndValidate(dc.dateSpecificHours[k]); err != nil {
			return nil, err
		}
	}
	if err := sortAndValidate(dc.holidayTimeRanges); err != nil {
		return nil, err
	}

	return dc, nil
}

func sortAndValidate(os []OpeningHour) error {
	sort.Sort(OpeningHourSlice(os))

	// it's already guaranteed that each To is after the respective From
	// value (see utils.ParseDayTime) and the slice is sorted by asc From
	// time. Therefore, we only need to check if there's a To time that's
	// after the From time of the next time range.
	for i := 0; i < len(os)-1; i++ {
		current := os[i]
		next := os[i+1]

		if current.EffectiveClose() >= next.EffectiveOpen() {
			return fmt.Errorf("overlapping time frames %s and %s", current, next)
		}
	}

	return nil
}

// Current returns the current door state.
func (dc *DoorController) Current(ctx context.Context) (DoorState, time.Time) {
	return dc.stateFor(ctx, time.Now())
}

// StateFor returns the desired door state for the time t.
func (dc *DoorController) StateFor(ctx context.Context, t time.Time) (DoorState, time.Time) {
	return dc.stateFor(ctx, t)
}

// TODO(ppacher): find out until when the returned door state is active.
// See TODOs below.
func (dc *DoorController) stateFor(ctx context.Context, t time.Time) (DoorState, time.Time) {
	var ranges []OpeningHour
	key := fmt.Sprintf("%02d/%02d", t.Month(), t.Day())

	// First we check for date specific overwrites ...
	ranges, ok := dc.dateSpecificHours[key]
	if !ok {
		isHoliday, err := dc.holidays.IsHoliday(dc.country, t)
		if err != nil {
			isHoliday = false
			logger.Errorf(ctx, "failed to load holidays: %s", err.Error())
		}

		if isHoliday {
			ranges = dc.holidayTimeRanges
		} else {
			// Finally use the regular opening hours
			ranges, ok = dc.regularOpeningHours[t.Weekday()]
			if !ok {
				// TODO(ppacher): find the next active slice on the next day
				return Locked, time.Time{}
			}
		}
	}

	// check if t is inside an opening-hour time-range.
	for _, tr := range ranges {
		timeRange := tr.At(t)

		// adjust the time range with the open-before and close-after thresholds.
		timeRange.From = timeRange.From.Add(-1 * tr.OpenBefore)
		timeRange.To = timeRange.To.Add(tr.CloseAfter)

		if timeRange.Covers(t) {
			return Unlocked, timeRange.To
		}
	}

	// TODO(ppacher): find the next active slice on the next day
	return Locked, time.Time{}
}
