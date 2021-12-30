package openinghours

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("openinghours")

type (
	OnChangeCallbackFunc func(oh *OpeningHour)

	// Controller keeps track of opening hours.
	Controller struct {
		location *time.Location

		holidays HolidayGetter

		// country is the country we are operating in and is required
		// to retrieve the correct list of public holidays.
		country string

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
func New(cfg cfgspec.Config, timeRanges []cfgspec.OpeningHours, holidays HolidayGetter) (*Controller, error) {
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

	dc := &Controller{
		location:            loc,
		country:             cfg.Country,
		holidays:            holidays,
		regularOpeningHours: make(map[time.Weekday][]OpeningHour),
		dateSpecificHours:   make(map[string][]OpeningHour),
		changeOnDuty:        make(map[time.Weekday]*ChangeOnCall),
	}

	// for each weekday, prepare the start times for the day and night
	// on-call shifts.
	for i := time.Sunday; i <= time.Saturday; i++ {
		dc.changeOnDuty[i] = &ChangeOnCall{
			dayStart:   defaultOnCallDayStart,
			nightStart: defaultOnCallNightStart,
			loc:        loc,
			weekday:    i,
		}
	}

	for _, c := range timeRanges {
		var (
			days  []time.Weekday
			dates []string
		)

		for _, d := range c.OnWeekday {
			if err := cfgspec.ValidDay(d); err != nil {
				return nil, err
			}

			parsed, ok := cfgspec.ParseDay(d)
			if !ok {
				return nil, fmt.Errorf("failed to parse day: %s", d)
			}

			if c.OnCallDayStart != "" {
				if dc.changeOnDuty[parsed].dayStart != defaultOnCallDayStart {
					return nil, fmt.Errorf("multiple values for OnCallDayStart= at weekday %s", parsed)
				}

				dayStart, err := daytime.ParseDayTime(c.OnCallDayStart)
				if err != nil {
					return nil, fmt.Errorf("invalid OnCallDayStart: %w", err)
				}
				dc.changeOnDuty[parsed].dayStart = dayStart
			}

			if c.OnCallNightStart != "" {
				if dc.changeOnDuty[parsed].nightStart != defaultOnCallNightStart {
					return nil, fmt.Errorf("multiple values for OnCallNightStart= at weekday %s", parsed)
				}

				nightStart, err := daytime.ParseDayTime(c.OnCallNightStart)
				if err != nil {
					return nil, fmt.Errorf("invalid OnCallNightStart: %w", err)
				}
				dc.changeOnDuty[parsed].nightStart = nightStart
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
			tr, err := daytime.ParseRange(r)
			if err != nil {
				return nil, err
			}

			closeAfter := c.CloseAfter
			if closeAfter == 0 {
				closeAfter = cfg.DefaultCloseAfter
			}

			openBefore := c.OpenBefore
			if openBefore == 0 {
				openBefore = cfg.DefaultOpenBefore
			}

			ranges = append(ranges, OpeningHour{
				Range:      tr,
				CloseAfter: closeAfter,
				OpenBefore: openBefore,
				Unofficial: c.Unofficial,
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
			return nil, fmt.Errorf("stanza Days= not allowed with Holiday=only")
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

// ChangeOnDuty returns the time at which the doctor-on-duty changes
// and the given date. It makes sure d is in the correct timezone.
// Note that ChangeOnDuty requires the Weekday of d which might differ
// depending on t's zone information. The caller must make sure to have
// t in the desired time zone!
func (ctrl *Controller) ChangeOnDuty(ctx context.Context, d time.Time) *ChangeOnCall {
	if d.Location() == time.UTC {
		log.From(ctx).Errorf("WARNING: ChnageOnDuty called with time in UTC")
	}

	change, ok := ctrl.changeOnDuty[d.Weekday()]
	if !ok {
		log.From(ctx).Errorf("no time for change-on-duty configured for %s (%d)", d.Weekday(), d)
		return nil
	}
	return change
}

func (ctrl *Controller) UpcomingFrames(ctx context.Context, t time.Time, limit int) []daytime.TimeRange {
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
		ranges := ctrl.ForDate(ctx, t)

		// Find the first frame that's after or covers t
		var idx int
		found := false
		for idx = range ranges {
			tr := ranges[idx].At(t, ctrl.location)
			tr.From = tr.From.Add(-ranges[idx].OpenBefore)
			tr.To = tr.To.Add(ranges[idx].CloseAfter)

			if tr.From.After(t) || tr.Covers(t) {
				found = true

				break
			}
		}

		if found {
			// all frames following idx are up-coming.
			for _, d := range ranges[idx:] {
				tr := d.At(t, ctrl.location)
				tr.From = tr.From.Add(-d.OpenBefore)
				tr.To = tr.To.Add(d.CloseAfter)
				result = append(result, *tr)
			}
		}

		// proceed to the next week day
		t = t.Add(24 * time.Hour)
		t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	}

	// truncate the result to the exact size requested
	// by the caller
	return result[0:limit]
}

func (ctrl *Controller) ForDate(ctx context.Context, t time.Time) []OpeningHour {
	t = t.In(ctrl.location)

	log := log.From(ctx)
	key := fmt.Sprintf("%02d/%02d", t.Month(), t.Day())

	// First we check for date specific overwrites ...
	ranges, ok := ctrl.dateSpecificHours[key]
	if ok {
		return ranges
	}

	// Check if we need to use holiday ranges ...
	isHoliday, err := ctrl.holidays.IsHoliday(ctx, ctrl.country, t)
	if err != nil {
		isHoliday = false
		log.Errorf("failed to load holidays: %s", err.Error())
	}
	if isHoliday {
		return ctrl.holidayTimeRanges
	}

	// Finally use the regular opening hours
	ranges, ok = ctrl.regularOpeningHours[t.Weekday()]
	if ok {
		return ranges
	}

	// There are no ranges for that day!
	log.V(4).Logf("No opening hour ranges found for %s", t)
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

func (ctrl *Controller) OnChange(ctx context.Context, fn OnChangeCallbackFunc) {

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
