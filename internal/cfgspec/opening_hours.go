package cfgspec

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

// OpeningHours is used to describe the opening and office hours.
type OpeningHours struct {
	ID string `option:"-"`

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

	// Unofficial can be set to true if the opening hour is unofficial. That is,
	// the entry door will be opened but no "work shift" is assigned for that specific
	// time frame and the doctor-on-duty is responsible instead.
	// TODO(ppacher): rework/rethink this together with tkd/cis#2.
	Unofficial bool
}

// OpeningHoursSpec describes the different configuration stanzas for the OpeningHours struct.
var OpeningHoursSpec = conf.SectionSpec{
	{
		Name:        "OnWeekday",
		Description: "A list of days (Mo, Tue, Wed, Thu, Fri, Sat, Sun) at which this section takes effect",
		Type:        conf.StringSliceType,
		Annotations: new(conf.Annotation).With(
			runtime.OneOf(
				runtime.PossibleValue{
					Value:   "Mon",
					Display: "Monday",
				},
				runtime.PossibleValue{
					Value:   "Tue",
					Display: "Tuesday",
				},
				runtime.PossibleValue{
					Value:   "Wed",
					Display: "Wednesday",
				},
				runtime.PossibleValue{
					Value:   "Thu",
					Display: "Thursday",
				},
				runtime.PossibleValue{
					Value:   "Fri",
					Display: "Friday",
				},
				runtime.PossibleValue{
					Value:   "Sat",
					Display: "Saturday",
				},
				runtime.PossibleValue{
					Value:   "Sun",
					Display: "Sunday",
				},
			),
		),
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
		Annotations: new(conf.Annotation).With(
			runtime.OneOf(
				runtime.PossibleValue{
					Value:   "yes",
					Display: "Yes",
				},
				runtime.PossibleValue{
					Value:   "no",
					Display: "No",
				},
				runtime.PossibleValue{
					Value:   "only",
					Display: "Only",
				},
			),
		),
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
	{
		Name:        "Unofficial",
		Type:        conf.BoolType,
		Description: "can be set to true if the opening hour is unofficial. That is, the entry door will be opened but no 'work shift' is assigned for that specific time frame and the doctor-on-duty is responsible instead.",
		Default:     "no",
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

var OnOpeningHourChangeFunc func(ctx context.Context, changeType string, oh OpeningHours) error

func addOpeningHours(s *runtime.ConfigSchema) error {
	return s.Register(runtime.Schema{
		Name:        "OpeningHour",
		DisplayName: "Öffnungszeiten",
		Description: "Opening hours definitions",
		Spec:        OpeningHoursSpec,
		Multi:       true,
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />`,
		Annotations: new(conf.Annotation).With(
			runtime.OverviewFields("OnWeekday", "UseAtDate", "Holiday", "TimeRanges"),
		),
		OnChange: func(ctx context.Context, changeType, id string, sec *conf.Section) error {
			var oh OpeningHours
			if sec != nil {
				if err := conf.DecodeSections(conf.Sections{*sec}, OpeningHoursSpec, &oh); err != nil {
					return err
				}
			}
			if err := oh.Validate(); err != nil {
				return err
			}

			oh.ID = id

			if OnOpeningHourChangeFunc != nil {
				return OnOpeningHourChangeFunc(ctx, changeType, oh)
			}

			return nil
		},
	})
}
