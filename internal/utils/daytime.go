package utils

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// DayTime represents a HH:MM time during the day.
type DayTime [2]int

// AsMinutes returns dt as a absolute number of minutes starting from
// midnight (00:00)
func (dt DayTime) AsMinutes() int {
	return dt[0]*60 + dt[1]
}

// AsDuration returns dt as a duration from midnight (00:00).
func (dt DayTime) AsDuration() time.Duration {
	return time.Duration(dt.AsMinutes()) * time.Minute
}

func (dt DayTime) String() string {
	return fmt.Sprintf("%02d:%02d", dt[0], dt[1])
}

// ParseDayTime parses a HH:MM time specification.
func ParseDayTime(str string) (DayTime, error) {
	var dt DayTime

	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return dt, fmt.Errorf("invalid format in %q", str)
	}

	if parts[0] == "" || parts[1] == "" {
		return dt, fmt.Errorf("invalid format: %q", str)
	}

	hourStr := strings.TrimLeft(parts[0], "0")
	if hourStr == "" {
		hourStr = "0"
	}
	hour, err := strconv.ParseInt(hourStr, 0, 64)
	if err != nil {
		return dt, fmt.Errorf("invalid hour: %q: %w", parts[0], err)
	}
	if hour < 0 || hour > 23 {
		return dt, fmt.Errorf("hour out of range: %d", hour)
	}
	dt[0] = int(hour)

	minStr := strings.TrimLeft(parts[1], "0")
	if minStr == "" {
		minStr = "0"
	}
	min, err := strconv.ParseInt(minStr, 0, 64)
	if err != nil {
		return dt, fmt.Errorf("invalid minute: %q: %w", parts[1], err)
	}
	if min < 0 || min > 59 {
		return dt, fmt.Errorf("minute out of range: %d", min)
	}
	dt[1] = int(min)

	return dt, nil
}

// DayTimeRange represents a range at any day
type DayTimeRange struct {
	From DayTime
	To   DayTime
}

func (dtr *DayTimeRange) String() string {
	return fmt.Sprintf("<%s - %s>", dtr.From.String(), dtr.To.String())
}

// FromTime returns the start time of the day-time range at t.
func (dtr *DayTimeRange) FromTime(t time.Time) time.Time {
	midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())

	return midnight.Add(dtr.From.AsDuration())
}

// ToTime returns the end time of the day-time range at t.
func (dtr *DayTimeRange) ToTime(t time.Time) time.Time {
	midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())

	return midnight.Add(dtr.To.AsDuration())
}

// At returns a the TimeRange that results when adding dtr to d.
func (dtr *DayTimeRange) At(d time.Time) *TimeRange {
	return &TimeRange{
		From: dtr.FromTime(d),
		To:   dtr.ToTime(d),
	}
}

// TimeRange defines a range in time that may start and end at different dates.
type TimeRange struct {
	From time.Time
	To   time.Time
}

// Covers returns true if t is covered by tr.
func (tr *TimeRange) Covers(t time.Time) bool {
	return (tr.From.Before(t) || tr.From.Equal(t)) && (tr.To.After(t) || tr.To.Equal(t))
}

// ParseDayTimeRange parses a day time range in the format of "HH:MM - HH:MM"
// and returns the result.
func ParseDayTimeRange(str string) (r DayTimeRange, err error) {
	parts := strings.Split(str, "-")
	if len(parts) != 2 {
		return r, fmt.Errorf("invalid format in %q", str)
	}

	r.From, err = ParseDayTime(strings.TrimSpace(parts[0]))
	if err != nil {
		return r, fmt.Errorf("start time: %w", err)
	}

	r.To, err = ParseDayTime(strings.TrimSpace(parts[1]))
	if err != nil {
		return r, fmt.Errorf("end time: %w", err)
	}

	if r.From.AsMinutes() >= r.To.AsMinutes() {
		return r, fmt.Errorf("start time after end time")
	}

	return r, nil
}