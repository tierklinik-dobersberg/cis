package openinghours

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var log = pkglog.New("openinghours")

type (
	OnChangeCallbackFunc func(oh *OpeningHour)

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
		defaultCloseAfter       time.Duration
		defaultOpenBefore       time.Duration

		state
	}

	state struct {
		// regularOpeningHours holds all regular opening hours.
		regularOpeningHours map[time.Weekday][]OpeningHour

		// dateSpecificHours contains opening hours that are used
		// instead of the regular opening hours at special days
		// during the year (like unofficial holidays or as a holiday
		// overwrite). The map key has the format "MM/DD".
		dateSpecificHours map[string][]OpeningHour

		// changeOnDuty specifies at which time per day the doctor-on
		// duty changes to the next one.
		changeOnDuty map[time.Weekday]*ChangeOnCall

		// holidayTimeRanges specifies the opening hours during
		// public holidays.
		holidayTimeRanges []OpeningHour
	}
)

// New returns a new opening hour controller.
func New(cfg cfgspec.Config, globalSchema *runtime.ConfigSchema, holidays HolidayGetter) (*Controller, error) {
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
		state: state{
			regularOpeningHours: make(map[time.Weekday][]OpeningHour),
			dateSpecificHours:   make(map[string][]OpeningHour),
			changeOnDuty:        make(map[time.Weekday]*ChangeOnCall),
		},
		defaultOnCallDayStart:   defaultOnCallDayStart,
		defaultOnCallNightStart: defaultOnCallNightStart,
		defaultCloseAfter:       cfg.DefaultCloseAfter,
		defaultOpenBefore:       cfg.DefaultOpenBefore,
	}

	// for each weekday, prepare the start times for the day and night
	// on-call shifts.
	for i := time.Sunday; i <= time.Saturday; i++ {
		ctrl.changeOnDuty[i] = &ChangeOnCall{
			dayStart:   defaultOnCallDayStart,
			nightStart: defaultOnCallNightStart,
			loc:        loc,
			weekday:    i,
		}
	}

	var openingHours []cfgspec.OpeningHours
	if err := globalSchema.DecodeSection(context.TODO(), "OpeningHour", &openingHours); err != nil {
		return nil, fmt.Errorf("failed to load opening hours: %w", err)
	}

	if err := ctrl.AddOpeningHours(openingHours...); err != nil {
		return nil, err
	}

	return ctrl, nil
}

func (s *state) clone() *state {
	newState := state{
		regularOpeningHours: make(map[time.Weekday][]OpeningHour, len(s.regularOpeningHours)),
		dateSpecificHours:   make(map[string][]OpeningHour, len(s.dateSpecificHours)),
		changeOnDuty:        make(map[time.Weekday]*ChangeOnCall, len(s.changeOnDuty)),
		holidayTimeRanges:   make([]OpeningHour, len(s.holidayTimeRanges)),
	}

	// clone the current state
	copy(newState.holidayTimeRanges, s.holidayTimeRanges)
	for wd, oh := range s.regularOpeningHours {
		clone := make([]OpeningHour, len(oh))
		copy(clone, oh)
		newState.regularOpeningHours[wd] = clone
	}
	for dateStr, oh := range s.dateSpecificHours {
		clone := make([]OpeningHour, len(oh))
		copy(clone, oh)
		newState.dateSpecificHours[dateStr] = clone
	}
	for wd, cod := range s.changeOnDuty {
		if cod != nil {
			newState.changeOnDuty[wd] = &ChangeOnCall{
				dayStart:   cod.dayStart,
				nightStart: cod.nightStart,
				loc:        cod.loc,
				weekday:    cod.weekday,
			}
		}
	}

	return &newState
}

func (s *state) sortAndValidate() error {
	// finally, sort all opening hours and make sure we don't have overlapping ones
	for k := range s.regularOpeningHours {
		if err := sortAndValidate(s.regularOpeningHours[k]); err != nil {
			return err
		}
	}
	for k := range s.dateSpecificHours {
		if err := sortAndValidate(s.dateSpecificHours[k]); err != nil {
			return err
		}
	}
	if err := sortAndValidate(s.holidayTimeRanges); err != nil {
		return err
	}

	return nil
}

func (ctrl *Controller) OnOpeningHourChange(ctx context.Context, changeType string, openingHour cfgspec.OpeningHours) error {
	ctrl.rw.Lock()
	defer ctrl.rw.Unlock()

	var errs = new(multierr.Error)

	// we delete for "delete" and "update".
	if changeType != "create" {
		if err := ctrl.deleteOpeningHour(openingHour.ID); err != nil {
			errs.Addf("failed to delete: %w", err)
		}
	}

	// we "create" for "create" and "update".
	if changeType != "delete" {
		if err := ctrl.addOpeningHours(openingHour); err != nil {
			errs.Addf("failed to create: %w", err)
		}
	}

	return errs.ToError()
}

func (ctrl *Controller) AddOpeningHours(timeRanges ...cfgspec.OpeningHours) error {
	ctrl.rw.Lock()
	defer ctrl.rw.Unlock()

	return ctrl.addOpeningHours(timeRanges...)
}

func (ctrl *Controller) deleteOpeningHour(id string) error {
	found := false
	for weekDay, openingHours := range ctrl.regularOpeningHours {
		res := make([]OpeningHour, 0, len(openingHours))
		for _, oh := range openingHours {
			if oh.ID == id {
				found = true

				continue
			}
			res = append(res, oh)
		}
		ctrl.regularOpeningHours[weekDay] = res
	}
	for dateStr, openingHours := range ctrl.dateSpecificHours {
		res := make([]OpeningHour, 0, len(openingHours))
		for _, oh := range openingHours {
			if oh.ID == id {
				found = true

				continue
			}
			res = append(res, oh)
		}
		ctrl.dateSpecificHours[dateStr] = res
	}

	res := make([]OpeningHour, 0, len(ctrl.holidayTimeRanges))
	for _, oh := range ctrl.holidayTimeRanges {
		if oh.ID == id {
			found = true

			continue
		}
		res = append(res, oh)
	}
	ctrl.holidayTimeRanges = res

	if !found {
		return fmt.Errorf("opening-hour: id %q not found in controller state", id)
	}

	return nil
}

func (ctrl *Controller) parseWeekDays(openingHourDef cfgspec.OpeningHours, newState *state) ([]time.Weekday, error) {
	days := make([]time.Weekday, 0, len(openingHourDef.OnWeekday))
	for _, d := range openingHourDef.OnWeekday {
		if err := cfgspec.ValidDay(d); err != nil {
			return nil, err
		}

		parsed, ok := cfgspec.ParseDay(d)
		if !ok {
			return nil, fmt.Errorf("failed to parse day: %s", d)
		}

		if openingHourDef.OnCallDayStart != "" {
			if newState.changeOnDuty[parsed].dayStart != ctrl.defaultOnCallDayStart {
				return nil, fmt.Errorf("multiple values for OnCallDayStart= at weekday %s", parsed)
			}

			dayStart, err := daytime.ParseDayTime(openingHourDef.OnCallDayStart)
			if err != nil {
				return nil, fmt.Errorf("invalid OnCallDayStart: %w", err)
			}
			newState.changeOnDuty[parsed].dayStart = dayStart
		}

		if openingHourDef.OnCallNightStart != "" {
			if newState.changeOnDuty[parsed].nightStart != ctrl.defaultOnCallNightStart {
				return nil, fmt.Errorf("multiple values for OnCallNightStart= at weekday %s", parsed)
			}

			nightStart, err := daytime.ParseDayTime(openingHourDef.OnCallNightStart)
			if err != nil {
				return nil, fmt.Errorf("invalid OnCallNightStart: %w", err)
			}
			newState.changeOnDuty[parsed].nightStart = nightStart
		}

		days = append(days, parsed)
	}

	return days, nil
}

func (ctrl *Controller) parseDates(c cfgspec.OpeningHours) ([]string, error) {
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

func (ctrl *Controller) getTimeRanges(openingHourDef cfgspec.OpeningHours) ([]OpeningHour, error) {
	ranges := make([]OpeningHour, 0, len(openingHourDef.TimeRanges))
	for _, r := range openingHourDef.TimeRanges {
		timeRange, err := daytime.ParseRange(r)
		if err != nil {
			return nil, err
		}

		closeAfter := openingHourDef.CloseAfter
		if closeAfter == 0 {
			closeAfter = ctrl.defaultCloseAfter
		}

		openBefore := openingHourDef.OpenBefore
		if openBefore == 0 {
			openBefore = ctrl.defaultOpenBefore
		}

		ranges = append(ranges, OpeningHour{
			ID:         openingHourDef.ID,
			Range:      timeRange,
			CloseAfter: closeAfter,
			OpenBefore: openBefore,
			Unofficial: openingHourDef.Unofficial,
		})
	}

	return ranges, nil
}

// trunk-ignore(golangci-lint/cyclop)
func (ctrl *Controller) addOpeningHours(timeRanges ...cfgspec.OpeningHours) error {
	newState := ctrl.state.clone()

	for _, openingHourDef := range timeRanges {
		days, err := ctrl.parseWeekDays(openingHourDef, newState)
		if err != nil {
			return err
		}

		dates, err := ctrl.parseDates(openingHourDef)
		if err != nil {
			return err
		}
		ranges, err := ctrl.getTimeRanges(openingHourDef)
		if err != nil {
			return err
		}

		holiday := strings.ToLower(openingHourDef.Holiday)

		// if its a setting for holidays as well (or holidays only)
		// add it to the correct slice.
		if holiday == "yes" || holiday == "only" {
			newState.holidayTimeRanges = append(newState.holidayTimeRanges, ranges...)
		}

		// if it's not for holidays only we need to add it to the regular
		// hours as well
		if holiday != "only" {
			for _, d := range days {
				newState.regularOpeningHours[d] = append(newState.regularOpeningHours[d], ranges...)
			}
		} else if len(days) > 0 {
			return fmt.Errorf("stanza Days= not allowed with Holiday=only")
		}

		// regardless of the holiday setting it's always possible to directly set
		// the hours for specific dates
		for _, d := range dates {
			newState.dateSpecificHours[d] = append(newState.dateSpecificHours[d], ranges...)
		}
	}

	if err := newState.sortAndValidate(); err != nil {
		return err
	}

	// actually replace the state data
	ctrl.state = *newState

	return nil
}

// ChangeOnDuty returns the time at which the doctor-on-duty changes
// and the given date. It makes sure d is in the correct timezone.
// Note that ChangeOnDuty requires the Weekday of d which might differ
// depending on t's zone information. The caller must make sure to have
// t in the desired time zone!
func (ctrl *Controller) ChangeOnDuty(ctx context.Context, date time.Time) *ChangeOnCall {
	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	if date.Location() == time.UTC {
		log.From(ctx).Errorf("WARNING: ChangeOnDuty called with time in UTC")
	}

	change, ok := ctrl.changeOnDuty[date.Weekday()]
	if !ok {
		log.From(ctx).Errorf("no time for change-on-duty configured for %s (%d)", date.Weekday(), date)

		return nil
	}

	return change
}

func (ctrl *Controller) UpcomingFrames(ctx context.Context, dateTime time.Time, limit int) []daytime.TimeRange {
	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	log := log.From(ctx)
	var result []daytime.TimeRange

	// Nothing to search for if there aren't any regular opening hours.
	// There could be some holiday-only or date-specific hours but that's rather a
	// configuration issue.
	if len(ctrl.regularOpeningHours) == 0 {
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
	ranges, ok := ctrl.dateSpecificHours[key]
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
		return ctrl.holidayTimeRanges
	}

	// Finally use the regular opening hours
	ranges, ok = ctrl.regularOpeningHours[date.Weekday()]
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
