package daytime

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Common error messages.
var (
	ErrInvalidFormat = errors.New("invalid format")
	ErrInvalidValue  = errors.New("invalid value")
)

// Midnight returns a new time that represents midnight at t.
func Midnight(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// DayTime represents a HH:MM time during the day.
type DayTime [2]int

// AsMinutes returns dt as a absolute number of minutes starting from
// midnight (00:00).
func (dt DayTime) AsMinutes() int {
	return dt[0]*60 + dt[1]
}

// AsDuration returns dt as a duration from midnight (00:00).
func (dt DayTime) AsDuration() time.Duration {
	return time.Duration(dt.AsMinutes()) * time.Minute
}

// At returns a new time.Time that represents dt at t.
func (dt DayTime) At(t time.Time, loc *time.Location) time.Time {
	if loc == nil {
		loc = t.Location()
	}
	midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)

	return midnight.Add(dt.AsDuration())
}

func (dt DayTime) String() string {
	return fmt.Sprintf("%02d:%02d", dt[0], dt[1])
}

func (dt DayTime) Equals(other DayTime) bool {
	return dt.AsDuration() == other.AsDuration()
}

func (dr DayTime) MarshalJSON() ([]byte, error) {
	return []byte(dr.String()), nil
}

func (dt DayTime) UnmarshalJSON(blob []byte) error {
	parsed, err := ParseDayTime(string(blob))
	if err != nil {
		return err
	}

	dt[0] = parsed[0]
	dt[1] = parsed[1]

	return nil
}

// ParseDayTime parses a HH:MM time specification.
func ParseDayTime(str string) (DayTime, error) {
	var dayTime DayTime

	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return dayTime, fmt.Errorf("%q: %w", str, ErrInvalidFormat)
	}

	if parts[0] == "" || parts[1] == "" {
		return dayTime, fmt.Errorf("%q: %w", str, ErrInvalidFormat)
	}

	hourStr := strings.TrimLeft(parts[0], "0")
	if hourStr == "" {
		hourStr = "0"
	}
	hour, err := strconv.ParseInt(hourStr, 0, 64)
	if err != nil {
		return dayTime, fmt.Errorf("hour %q: %w", parts[0], ErrInvalidValue)
	}
	if hour < 0 || hour > 23 {
		return dayTime, fmt.Errorf("hour %d: %w", hour, ErrInvalidValue)
	}
	dayTime[0] = int(hour)

	minStr := strings.TrimLeft(parts[1], "0")
	if minStr == "" {
		minStr = "0"
	}
	min, err := strconv.ParseInt(minStr, 0, 64)
	if err != nil {
		return dayTime, fmt.Errorf("minute: %q: %w", parts[1], ErrInvalidValue)
	}
	if min < 0 || min > 59 {
		return dayTime, fmt.Errorf("minute %d: %w", min, ErrInvalidValue)
	}
	dayTime[1] = int(min)

	return dayTime, nil
}

// Range represents a range at any day.
type Range struct {
	From DayTime `json:"from"`
	To   DayTime `json:"to"`
}

func (dtr *Range) String() string {
	return fmt.Sprintf("<%s - %s>", dtr.From.String(), dtr.To.String())
}

// At returns a the TimeRange that results when adding dtr to d.
func (dtr *Range) At(d time.Time, loc *time.Location) *TimeRange {
	return &TimeRange{
		From: dtr.From.At(d, loc),
		To:   dtr.To.At(d, loc),
	}
}

// TimeRange defines a range in time that may start and end at different dates.
type TimeRange struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// Covers returns true if t is covered by tr.
func (tr *TimeRange) Covers(t time.Time) bool {
	return (tr.From.Before(t) || tr.From.Equal(t)) && (tr.To.After(t) || tr.To.Equal(t))
}

// ParseRange parses a day time range in the format of "HH:MM - HH:MM"
// and returns the result.
func ParseRange(str string) (r Range, err error) {
	parts := strings.Split(str, "-")
	if len(parts) != 2 {
		return r, fmt.Errorf("%q: %w", str, ErrInvalidFormat)
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
		return r, fmt.Errorf("%w: start time after end time", ErrInvalidValue)
	}

	return r, nil
}
