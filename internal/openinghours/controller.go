package openinghours

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

var log = pkglog.New("openinghours")

type (
	// Controller keeps track of opening hours.
	Controller struct {
		rw sync.RWMutex

		location *time.Location

		holidays HolidayGetter

		// country is the country we are operating in and is required
		// to retrieve the correct list of public holidays.
		country string

		defaultOnCallDayStart   daytime.DayTime
		defaultOnCallNightStart daytime.DayTime

		state *state
	}
)

// New returns a new opening hour controller.
func New(ctx context.Context, cfg cfgspec.Config, globalSchema *runtime.ConfigSchema, holidays HolidayGetter) (*Controller, error) {
	loc, err := time.LoadLocation(cfg.TimeZone)
	if err != nil {
		return nil, fmt.Errorf("option Location: %w", err)
	}

	defaultOnCallDayStart, err := daytime.ParseDayTime(cfg.DefaultOnCallDayStart)
	if err != nil {
		return nil, fmt.Errorf("option DefaultOnCallDayStart: %w", err)
	}
	defaultOnCallNightStart, err := daytime.ParseDayTime(cfg.DefaultOnCallNightStart)
	if err != nil {
		return nil, fmt.Errorf("option DefaultOnCallNightStart: %w", err)
	}

	ctrl := &Controller{
		location: loc,
		country:  cfg.Country,
		holidays: holidays,
		state: &state{
			Regular:           make(map[time.Weekday][]OpeningHour),
			DateSpecific:      make(map[string][]OpeningHour),
			defaultCloseAfter: cfg.DefaultCloseAfter,
			defaultOpenBefore: cfg.DefaultOpenBefore,
		},
		defaultOnCallDayStart:   defaultOnCallDayStart,
		defaultOnCallNightStart: defaultOnCallNightStart,
	}

	globalSchema.AddValidator(ctrl, "OpeningHour")
	globalSchema.AddNotifier(ctrl, "OpeningHour")

	sections, err := globalSchema.All(ctx, "OpeningHour")
	if err != nil {
		return nil, fmt.Errorf("failed to get existing configuration: %w", err)
	}
	for _, def := range sections {
		if err := ctrl.NotifyChange(ctx, "create", def.ID, &def.Section); err != nil {
			return nil, fmt.Errorf("failed to create opening hour %s: %w", def.ID, err)
		}
	}

	return ctrl, nil
}

func decodeOpeningHour(sec *conf.Section) (Definition, error) {
	var entry Definition

	if sec != nil {
		if err := conf.DecodeSections(conf.Sections{*sec}, Spec, &entry); err != nil {
			return entry, err
		}
		if err := entry.Validate(); err != nil {
			return entry, err
		}
	}

	return entry, nil
}

func (ctrl *Controller) Validate(ctx context.Context, sec runtime.Section) error {
	openingHour, err := decodeOpeningHour(&sec.Section)
	if err != nil {
		return err
	}
	openingHour.id = sec.ID

	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	testState := ctrl.state.clone()

	if openingHour.id != "" {
		if err := testState.deleteOpeningHour(ctx, openingHour.id); err != nil {
			return err
		}
	}

	if err := testState.addOpeningHours(ctx, openingHour); err != nil {
		return err
	}

	return nil
}

func (ctrl *Controller) NotifyChange(ctx context.Context, changeType string, id string, sec *conf.Section) error {
	openingHour, err := decodeOpeningHour(sec)
	if err != nil {
		return err
	}
	openingHour.id = id

	ctrl.rw.Lock()
	defer ctrl.rw.Unlock()

	var errs = new(multierr.Error)

	newState := ctrl.state.clone()

	// we delete for "delete" and "update".
	if changeType != "create" {
		if err := newState.deleteOpeningHour(ctx, openingHour.id); err != nil {
			errs.Addf("failed to delete: %w", err)
		}
	}

	// we "create" for "create" and "update".
	if changeType != "delete" {
		if err := newState.addOpeningHours(ctx, openingHour); err != nil {
			errs.Addf("failed to create: %w", err)
		}
	}

	if err := errs.ToError(); err != nil {
		return err
	}

	ctrl.state = newState

	return nil
}

func (ctrl *Controller) AddOpeningHours(ctx context.Context, timeRanges ...Definition) error {
	ctrl.rw.Lock()
	defer ctrl.rw.Unlock()

	newState := ctrl.state.clone()

	if err := newState.addOpeningHours(ctx, timeRanges...); err != nil {
		return err
	}

	ctrl.state = newState

	return nil
}

// ChangeOnDuty returns the time at which the doctor-on-duty changes
// and the given date. It makes sure d is in the correct timezone.
// Note that ChangeOnDuty requires the Weekday of d which might differ
// depending on t's zone information. The caller must make sure to have
// t in the desired time zone!
// trunk-ignore(golangci-lint/cyclop)
func (ctrl *Controller) ChangeOnDuty(ctx context.Context, date time.Time) ChangeOnCall {
	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	if date.Location() == time.UTC {
		log.From(ctx).Errorf("WARNING: ChangeOnDuty called with time in UTC")
	}
	key := fmt.Sprintf("%02d/%02d", date.Month(), date.Day())

	var (
		startDay       *daytime.DayTime
		startDayFrom   string
		startNight     *daytime.DayTime
		startNightFrom string
	)

	findStartTimes := func(openingHours []OpeningHour, source string) {
		if startDay != nil && startNight != nil {
			return
		}

		for idx := range openingHours {
			oh := openingHours[idx]

			if oh.OnCallStartDay != nil && startDay == nil {
				startDay = oh.OnCallStartDay
				startDayFrom = source
			}
			if oh.OnCallStartNight != nil && startNight == nil {
				startNight = oh.OnCallStartNight
				startNightFrom = source
			}
			if startDay != nil && startNight != nil {
				break
			}
		}
	}

	findStartTimes(ctrl.state.DateSpecific[key], "date-specific")

	// Check if we need to use holiday ranges ...
	isHoliday, err := ctrl.holidays.IsHoliday(ctx, ctrl.country, date)
	if err != nil {
		isHoliday = false
		log.From(ctx).Errorf("failed to load holidays: %s", err.Error())
	}
	if isHoliday {
		findStartTimes(ctrl.state.Holiday, "holiday")
	}

	findStartTimes(ctrl.state.Regular[date.Weekday()], "regular")

	if startDay == nil {
		startDay = &ctrl.defaultOnCallDayStart
		startDayFrom = "default"
	}
	if startNight == nil {
		startNight = &ctrl.defaultOnCallNightStart
		startNightFrom = "default"
	}

	log.From(ctx).WithFields(logger.Fields{
		"weekday":          date.Weekday().String(),
		"date-key":         key,
		"startDay":         startDay.String(),
		"startDaySource":   startDayFrom,
		"startNight":       startNight.String(),
		"startNightSource": startNightFrom,
	}).V(7).Logf("change on duty found")

	return ChangeOnCall{
		dayStart:         *startDay,
		nightStart:       *startNight,
		loc:              ctrl.location,
		SourceDayStart:   startDayFrom,
		SourceNightStart: startNightFrom,
	}
}

func (ctrl *Controller) UpcomingFrames(ctx context.Context, dateTime time.Time, limit int) []daytime.TimeRange {
	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	log := log.From(ctx)
	var result []daytime.TimeRange

	// Nothing to search for if there aren't any regular opening hours.
	// There could be some holiday-only or date-specific hours but that's rather a
	// configuration issue.
	if len(ctrl.state.Regular) == 0 {
		log.Errorf("no regular opening hours configured")

		return nil
	}

	for len(result) < limit {
		ranges := ctrl.forDate(ctx, dateTime)

		// Find the first frame that's after or covers t
		var idx int
		found := false
		for idx = range ranges {
			tr := ranges[idx].At(dateTime, ctrl.location)
			tr.From = tr.From.Add(-ranges[idx].OpenBefore)
			tr.To = tr.To.Add(ranges[idx].CloseAfter)

			if tr.From.After(dateTime) || tr.Covers(dateTime) {
				found = true

				break
			}
		}

		if found {
			// all frames following idx are up-coming.
			for _, d := range ranges[idx:] {
				tr := d.At(dateTime, ctrl.location)
				tr.From = tr.From.Add(-d.OpenBefore)
				tr.To = tr.To.Add(d.CloseAfter)
				result = append(result, *tr)
			}
		}

		// proceed to the next week day
		dateTime = dateTime.Add(24 * time.Hour)
		dateTime = time.Date(dateTime.Year(), dateTime.Month(), dateTime.Day(), 0, 0, 0, 0, dateTime.Location())
	}

	// truncate the result to the exact size requested
	// by the caller
	return result[0:limit]
}

func (ctrl *Controller) ForDate(ctx context.Context, date time.Time) []OpeningHour {
	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	return ctrl.forDate(ctx, date)
}

func (ctrl *Controller) forDate(ctx context.Context, date time.Time) []OpeningHour {
	date = date.In(ctrl.location)

	log := log.From(ctx)
	key := fmt.Sprintf("%02d/%02d", date.Month(), date.Day())

	// First we check for date specific overwrites ...
	ranges, ok := ctrl.state.DateSpecific[key]
	if ok {
		return ranges
	}

	// Check if we need to use holiday ranges ...
	isHoliday, err := ctrl.holidays.IsHoliday(ctx, ctrl.country, date)
	if err != nil {
		isHoliday = false
		log.Errorf("failed to load holidays: %s", err.Error())
	}
	if isHoliday {
		return ctrl.state.Holiday
	}

	// Finally use the regular opening hours
	ranges, ok = ctrl.state.Regular[date.Weekday()]
	if ok {
		return ranges
	}

	// There are no ranges for that day!
	log.V(4).Logf("No opening hour ranges found for %s", date)

	return nil
}

// Location returns the location the controller is configured for.
func (ctrl *Controller) Location() *time.Location {
	return ctrl.location
}

// Country returns the name of the country the controller is configured
// for. The country is important to detect public holidays.
func (ctrl *Controller) Country() string {
	return ctrl.country
}

func sortAndValidate(slice []OpeningHour) error {
	sort.Sort(OpeningHourSlice(slice))

	// it's already guaranteed that each To is after the respective From
	// value (see utils.ParseDayTime) and the slice is sorted by asc From
	// time. Therefore, we only need to check if there's a To time that's
	// after the From time of the next time range.
	for i := 0; i < len(slice)-1; i++ {
		current := slice[i]
		next := slice[i+1]

		if current.EffectiveClose() >= next.EffectiveOpen() {
			return fmt.Errorf("overlapping time frames %s and %s", current, next)
		}
	}

	// make sure we have at moste on onCall start per day/night
	var (
		foundDay   string
		foundNight string
	)
	for _, iter := range slice {
		if iter.OnCallStartDay != nil {
			if foundDay != "" {
				return fmt.Errorf("OnCallDayStart= defined multiple times in %s and %s", foundDay, iter.ID)
			}
			foundDay = iter.ID
		}

		if iter.OnCallStartNight != nil {
			if foundNight != "" {
				return fmt.Errorf("OnCallNightStart= defined multiple times in %s and %s", foundNight, iter.ID)
			}
			foundNight = iter.ID
		}
	}

	return nil
}
