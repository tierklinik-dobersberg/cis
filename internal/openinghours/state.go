package openinghours

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
)

type state struct {
	// Regular holds all regular opening hours.
	Regular map[time.Weekday][]OpeningHour `json:"regular"`

	// DateSpecific contains opening hours that are used
	// instead of the regular opening hours at special days
	// during the year (like unofficial holidays or as a holiday
	// overwrite). The map key has the format "MM/DD".
	DateSpecific map[string][]OpeningHour `json:"dateSpecific"`
	// Holiday specifies the opening hours during
	// public holidays.
	Holiday []OpeningHour `json:"holiday"`

	defaultCloseAfter time.Duration
	defaultOpenBefore time.Duration
}

func (s *state) clone() *state {
	newState := &state{
		Regular:           make(map[time.Weekday][]OpeningHour, len(s.Regular)),
		DateSpecific:      make(map[string][]OpeningHour, len(s.DateSpecific)),
		Holiday:           make([]OpeningHour, len(s.Holiday)),
		defaultCloseAfter: s.defaultCloseAfter,
		defaultOpenBefore: s.defaultOpenBefore,
	}

	// clone the current state
	newState.Holiday = make([]OpeningHour, len(s.Holiday))
	copy(newState.Holiday, s.Holiday)

	for wd, oh := range s.Regular {
		clone := make([]OpeningHour, len(oh))
		copy(clone, oh)
		newState.Regular[wd] = clone
	}

	for dateStr, oh := range s.DateSpecific {
		clone := make([]OpeningHour, len(oh))
		copy(clone, oh)

		newState.DateSpecific[dateStr] = clone
	}

	return newState
}

func (s *state) sortAndValidate() error {
	// finally, sort all opening hours and make sure we don't have overlapping ones
	for k := range s.Regular {
		if err := sortAndValidate(s.Regular[k]); err != nil {
			return fmt.Errorf("regular: %w", err)
		}
	}
	for k := range s.DateSpecific {
		if err := sortAndValidate(s.DateSpecific[k]); err != nil {
			return fmt.Errorf("date-specific: %w", err)
		}
	}
	if err := sortAndValidate(s.Holiday); err != nil {
		return fmt.Errorf("holiday: %w", err)
	}

	return nil
}

func (s *state) deleteOpeningHour(_ context.Context, id string) error {
	found := false
	for weekDay, openingHours := range s.Regular {
		res := make([]OpeningHour, 0, len(openingHours))
		for _, oh := range openingHours {
			if oh.ID == id {
				found = true

				continue
			}
			res = append(res, oh)
		}
		s.Regular[weekDay] = res
	}

	for dateStr, openingHours := range s.DateSpecific {
		res := make([]OpeningHour, 0, len(openingHours))
		for _, oh := range openingHours {
			if oh.ID == id {
				found = true

				continue
			}
			res = append(res, oh)
		}
		s.DateSpecific[dateStr] = res
	}

	res := make([]OpeningHour, 0, len(s.Holiday))
	for _, oh := range s.Holiday {
		if oh.ID == id {
			found = true

			continue
		}
		res = append(res, oh)
	}
	s.Holiday = res

	if !found {
		return fmt.Errorf("opening-hour: id %q not found in controller state: %+v", id, s)
	}

	return nil
}

func (s *state) parseWeekDays(openingHourDef Definition) ([]time.Weekday, error) {
	days := make([]time.Weekday, 0, len(openingHourDef.OnWeekday))
	for _, d := range openingHourDef.OnWeekday {
		if err := ValidDay(d); err != nil {
			return nil, err
		}

		parsed, ok := ParseDay(d)
		if !ok {
			return nil, fmt.Errorf("failed to parse day: %s", d)
		}

		days = append(days, parsed)
	}

	return days, nil
}

func (s *state) parseDates(c Definition) ([]string, error) {
	dates := make([]string, 0, len(c.UseAtDate))
	for _, dateStr := range c.UseAtDate {
		parts := strings.Split(dateStr, "/")
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid date: %q", dateStr)
		}

		month, err := strconv.ParseInt(strings.TrimLeft(parts[0], "0"), 0, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid date: %q: %w", dateStr, err)
		}
		if month < 0 || month > 12 {
			return nil, fmt.Errorf("invalid month: %d", month)
		}

		day, err := strconv.ParseInt(strings.TrimLeft(parts[1], "0"), 0, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid date: %q: %w", dateStr, err)
		}
		if day < 0 || day > 31 {
			return nil, fmt.Errorf("invalid day: %d", day)
		}

		dates = append(dates, fmt.Sprintf("%02d/%02d", month, day))
	}

	return dates, nil
}

func (s *state) parseOnCallStartTimes(openingHourDef Definition) (day *daytime.DayTime, night *daytime.DayTime, err error) {
	if openingHourDef.OnCallDayStart != "" {
		dayStart, err := daytime.ParseDayTime(openingHourDef.OnCallDayStart)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid OnCallDayStart: %w", err)
		}
		day = &dayStart
	}

	if openingHourDef.OnCallNightStart != "" {
		nightStart, err := daytime.ParseDayTime(openingHourDef.OnCallNightStart)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid OnCallNightStart: %w", err)
		}
		night = &nightStart
	}

	return day, night, nil
}

func (s *state) getTimeRanges(openingHourDef Definition) ([]OpeningHour, error) {
	ranges := make([]OpeningHour, 0, len(openingHourDef.TimeRanges))
	for _, r := range openingHourDef.TimeRanges {
		timeRange, err := daytime.ParseRange(r)
		if err != nil {
			return nil, err
		}

		closeAfter := openingHourDef.CloseAfter
		if closeAfter == 0 {
			closeAfter = s.defaultCloseAfter
		}

		openBefore := openingHourDef.OpenBefore
		if openBefore == 0 {
			openBefore = s.defaultOpenBefore
		}

		day, night, err := s.parseOnCallStartTimes(openingHourDef)
		if err != nil {
			return nil, err
		}

		ranges = append(ranges, OpeningHour{
			ID:               openingHourDef.id,
			Range:            timeRange,
			CloseAfter:       closeAfter,
			OpenBefore:       openBefore,
			Unofficial:       openingHourDef.Unofficial,
			OnCallStartDay:   day,
			OnCallStartNight: night,
		})
	}

	return ranges, nil
}

// trunk-ignore(golangci-lint/cyclop)
func (s *state) addOpeningHours(_ context.Context, timeRanges ...Definition) error {
	for _, openingHourDef := range timeRanges {
		days, err := s.parseWeekDays(openingHourDef)
		if err != nil {
			return err
		}

		dates, err := s.parseDates(openingHourDef)
		if err != nil {
			return err
		}

		ranges, err := s.getTimeRanges(openingHourDef)
		if err != nil {
			return err
		}

		if len(ranges) == 0 {
			return fmt.Errorf("no time ranges defined in opening hour")
		}

		holiday := strings.ToLower(openingHourDef.Holiday)

		// if its a setting for holidays as well (or holidays only)
		// add it to the correct slice.
		if holiday == "yes" || holiday == "only" {
			s.Holiday = append(s.Holiday, ranges...)
		}

		// if it's not for holidays only we need to add it to the regular
		// hours as well
		if holiday != "only" {
			for _, d := range days {
				s.Regular[d] = append(s.Regular[d], ranges...)
			}
		} else if len(days) > 0 {
			return fmt.Errorf("stanza Days= not allowed with Holiday=only")
		}

		// regardless of the holiday setting it's always possible to directly set
		// the hours for specific dates
		for _, d := range dates {
			s.DateSpecific[d] = append(s.DateSpecific[d], ranges...)
		}
	}

	if err := s.sortAndValidate(); err != nil {
		return err
	}

	return nil
}
