package schema

import (
	"fmt"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
)

type OpeningHours struct {
	// Days is a list of days (Mo, Tue, ...) on which this opening
	// hours take effect.
	Days []string

	// Dates is a list of dates on which this opening hours take effect.
	// Should follow the ISO RFC3339 format
	Dates []string

	// OpenBefore describes the amount of time the entry door
	// should open before the specified time.
	OpenBefore string

	// CloseAfter describes the amount of time the entry door
	// should close after the specified time.
	CloseAfter string

	// TimeRanges describe the opening hours on the specified days
	// in the format of HH:MM - HH:MM
	TimeRanges []string
}

var OpeningHoursSpec = conf.SectionSpec{
	{
		Name:        "Days",
		Description: "A list of days (Mo, Tue, Wed, Thu, Fri, Sat, Sun) at which this section takes effect",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "Dates",
		Description: "A list of dates at which this section takes effect. Format is defined by the DatesFormat= stanza in [Global]",
		Type:        conf.StringSliceType,
	},
	{
		Name:    "OpenBefore",
		Type:    conf.StringType,
		Default: "0m",
	},
	{
		Name:    "CloseAfter",
		Type:    conf.StringType,
		Default: "0m",
	},
	{
		Name:        "TimeRanges",
		Type:        conf.StringSliceType,
		Description: "A list of office/opening hour time ranges (HH:MM - HH:MM).",
	},
}

// Validate validates the opening hours defined in opt.
func (opt *OpeningHours) Validate() error {
	// validate all days
	for _, day := range opt.Days {
		if err := ValidDay(day); err != nil {
			return err
		}
	}

	return nil
}

// ParseDay parses the weekday specified in day. For strict parsing,
// day should be validated using ValidDay before using ParseDay.
func ParseDay(day string) (time.Weekday, bool) {
	days := map[string]time.Weekday{
		"mo": time.Monday,
		"tu": time.Tuesday,
		"we": time.Wednesday,
		"th": time.Thursday,
		"fr": time.Friday,
		"sa": time.Saturday,
		"su": time.Sunday,
	}

	if len(day) < 2 {
		return 0, false
	}

	d, ok := days[strings.ToLower(day[0:2])]
	return d, ok
}

var validDaySpecs = []string{
	"Monday", "Mo", "Mon",
	"Tuesday", "Tu", "Tue",
	"Wednesday", "We", "Wed",
	"Thursday", "Th", "Thu",
	"Friday", "Fr", "Fri",
	"Saturday", "Sa", "Sat",
	"Sunday", "Su", "Sun",
}

// ValidDay checks if day represents a valid weekday.
func ValidDay(day string) error {
	dl := strings.ToLower(day)
	for _, e := range validDaySpecs {
		if strings.ToLower(e) == dl {
			return nil
		}
	}
	return fmt.Errorf("invalid day: %s", day)
}
