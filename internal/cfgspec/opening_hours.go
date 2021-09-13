package cfgspec

import (
	"fmt"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
)

// OpeningHours is used to describe the opening and office hours.
type OpeningHours struct {
	// OnWeekday is a list of days (Mo, Tue, ...) on which this opening
	// hours take effect.
	OnWeekday []string

	// UseAtDate is a list of dates on which this opening hours take effect.
	// UseAtDate should have the format MM/DD and are year independent.
	UseAtDate []string

	// OpenBefore describes the amount of time the entry door
	// should open before the specified time.
	OpenBefore time.Duration

	// CloseAfter describes the amount of time the entry door
	// should close after the specified time.
	CloseAfter time.Duration

	// TimeRanges describe the opening hours on the specified days
	// in the format of HH:MM - HH:MM.
	TimeRanges []string

	// OnCallDayStart defines the time the day-shift for the on-call doctor
	// starts. This also denotes the end of the previous night shift.
	// Format is HH:MM in the configured timezone.
	OnCallDayStart string

	// OnCallNightStart defines the time the night-shift for the on-call doctor
	// starts. This also denotes the endof the previous day shift.
	// Format is HH:MM in the configured timezone.
	OnCallNightStart string

	// Holiday controls whether this setting is in effect on holidays.
	Holiday string
}

// OpeningHoursSpec describes the different configuratoin stanzas for the OpeningHours struct.
var OpeningHoursSpec = conf.SectionSpec{
	{
		Name:        "OnWeekday",
		Description: "A list of days (Mo, Tue, Wed, Thu, Fri, Sat, Sun) at which this section takes effect",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "UseAtDate",
		Description: "A list of dates at which this section takes effect. Format is defined MM/DD",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "OpenBefore",
		Type:        conf.DurationType,
		Description: "Defines how long before the opening hour the entry door to should get unlocked.",
	},
	{
		Name:        "CloseAfter",
		Type:        conf.DurationType,
		Description: "Defines how long after the opening hour the entry door should get locked.",
	},
	{
		Name:        "TimeRanges",
		Type:        conf.StringSliceType,
		Description: "A list of office/opening hour time ranges (HH:MM - HH:MM).",
	},
	{
		Name:        "Holiday",
		Type:        conf.StringType,
		Description: "Whether or not this opening hour counts on holidays. Possible values are 'yes' (normal and holidays), 'no' (normal only) or 'only' (holiday only).",
	},
	{
		Name:        "OnCallDayStart",
		Type:        conf.StringType,
		Description: "Defines the time the day-shift for the on-call doctor starts. This also denotes the end of the prvious night shift. Format is HH:MM in the configured timezone.",
	},
	{
		Name:        "OnCallNightStart",
		Type:        conf.StringType,
		Description: "Defines the time the night-shift for the on-call doctor starts. This also denotes the end of the prvious day shift. Format is HH:MM in the configured timezone.",
	},
}

// Validate validates the opening hours defined in opt.
func (opt *OpeningHours) Validate() error {
	// validate all days
	for _, day := range opt.OnWeekday {
		if err := ValidDay(day); err != nil {
			return err
		}
	}
	if opt.OnCallDayStart != "" {
		if _, err := daytime.ParseDayTime(opt.OnCallDayStart); err != nil {
			return fmt.Errorf("OnCallDayStart: %w", err)
		}
	}
	if opt.OnCallNightStart != "" {
		if _, err := daytime.ParseDayTime(opt.OnCallNightStart); err != nil {
			return fmt.Errorf("OnCallNightStart: %w", err)
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
