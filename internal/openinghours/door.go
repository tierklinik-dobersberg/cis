package openinghours

// TODO(ppacher): move all the parsing work away from this package to schema or utils.

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tevino/abool"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("openinghours")

// DoorState describes the current state of the entry door.
type DoorState string

// Possible door states
const (
	Locked   = DoorState("locked")
	Unlocked = DoorState("unlocked")
)

// Reset types
var (
	resetSoft = (*struct{})(nil)
	resetHard = &struct{}{}
)

type stateOverwrite struct {
	state       DoorState
	until       time.Time
	sessionUser string
}

// DoorController interacts with the entry door controller via MQTT.
type DoorController struct {
	location *time.Location

	holidays HolidayGetter

	// door is the actual interface to communicagte the door.
	door DoorInterfacer

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

	// overwriteLock protects access to manualOverwrite.
	overwriteLock sync.Mutex

	// manualOverwrite is set when a user has manually overwritten
	// the current state of the entry door.
	manualOverwrite *stateOverwrite

	// stop is closed whne the scheduler should stop.
	stop chan struct{}

	// reset triggers a reset of the scheduler.
	// A nil value means soft-reset while struct{}{}
	// is interpreted as a hard-reset causing a unlock-lock-unlock
	// sequence
	reset chan *struct{}

	// Whether or not a door reset is currently in progress.
	resetInProgress *abool.AtomicBool

	// wg is used to wait for door controller operations to finish.
	wg sync.WaitGroup
}

// NewDoorController returns a new door controller.
func NewDoorController(cfg cfgspec.Config, timeRanges []cfgspec.OpeningHours, holidays HolidayGetter, door DoorInterfacer) (*DoorController, error) {
	loc, err := time.LoadLocation(cfg.TimeZone)
	if err != nil {
		return nil, fmt.Errorf("Location: %w", err)
	}

	defaultOnCallDayStart, err := utils.ParseDayTime(cfg.DefaultOnCallDayStart)
	if err != nil {
		return nil, fmt.Errorf("DefaultOnCallDayStart: %w", err)
	}
	defaultOnCallNightStart, err := utils.ParseDayTime(cfg.DefaultOnCallNightStart)
	if err != nil {
		return nil, fmt.Errorf("DefaultOnCallNightStart: %w", err)
	}

	dc := &DoorController{
		location:            loc,
		country:             cfg.Country,
		holidays:            holidays,
		regularOpeningHours: make(map[time.Weekday][]OpeningHour),
		dateSpecificHours:   make(map[string][]OpeningHour),
		changeOnDuty:        make(map[time.Weekday]*ChangeOnCall),
		door:                door,
		stop:                make(chan struct{}),
		reset:               make(chan *struct{}),
		resetInProgress:     abool.NewBool(false),
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

				dayStart, err := utils.ParseDayTime(c.OnCallDayStart)
				if err != nil {
					return nil, fmt.Errorf("invalid OnCallDayStart: %w", err)
				}
				dc.changeOnDuty[parsed].dayStart = dayStart
			}

			if c.OnCallNightStart != "" {
				if dc.changeOnDuty[parsed].nightStart != defaultOnCallNightStart {
					return nil, fmt.Errorf("multiple values for OnCallNightStart= at weekday %s", parsed)
				}

				nightStart, err := utils.ParseDayTime(c.OnCallNightStart)
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
			tr, err := utils.ParseDayTimeRange(r)
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

// Overwrite overwrites the current door state with state until untilTime.
func (dc *DoorController) Overwrite(ctx context.Context, state DoorState, untilTime time.Time) error {
	log.From(ctx).V(7).Logf("overwritting door state to %s until %s", state, untilTime)

	if err := isValidState(state); err != nil {
		return err
	}

	dc.overwriteLock.Lock()
	{
		dc.manualOverwrite = &stateOverwrite{
			state:       state,
			sessionUser: utils.GetUser(ctx),
			until:       untilTime,
		}
	}
	dc.overwriteLock.Unlock()

	// trigger a soft reset, unlocking above is REQUIRED
	// to avoid deadlocking with getManualOverwrite() in
	// scheduler() (which triggers immediately)
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-dc.stop:
		return errors.New("stopped")
	case dc.reset <- resetSoft:
		log.From(ctx).V(6).Logf("door overwrite forcing %s until %s done", state, untilTime)
	}

	return nil
}

// Lock implements DoorInterfacer.
func (dc *DoorController) Lock(ctx context.Context) error {
	dc.wg.Add(1)
	defer dc.wg.Done()
	return dc.door.Lock(ctx)
}

// Unlock implements DoorInterfacer.
func (dc *DoorController) Unlock(ctx context.Context) error {
	dc.wg.Add(1)
	defer dc.wg.Done()
	return dc.door.Unlock(ctx)
}

// Open implements DoorInterfacer.
func (dc *DoorController) Open(ctx context.Context) error {
	dc.wg.Add(1)
	defer dc.wg.Done()
	return dc.door.Open(ctx)
}

// Start starts the scheduler for the door controller.
func (dc *DoorController) Start() error {
	dc.wg.Add(1)
	go dc.scheduler()

	return nil
}

// Stop requests the scheduler to stop and waits for all
// operations to complete.
func (dc *DoorController) Stop() error {
	close(dc.stop)

	dc.wg.Wait()

	return nil
}

// Reset triggers a reset of the door scheduler.
func (dc *DoorController) Reset(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()

	case <-dc.stop:
		return errors.New("stopped")

	// trigger a hard-reset
	case dc.reset <- resetHard:
		return nil
	}
}

// resetDoor resets the entry door by unlocking, locking and unlocking
// it again. For whatever reason, this proved to work best when the door
// does not behave as it should.
func (dc *DoorController) resetDoor(ctx context.Context) {
	dc.wg.Add(1)
	defer dc.wg.Done()

	dc.resetInProgress.Set()
	defer dc.resetInProgress.UnSet()

	// remove any manual overwrite when we do a reset.
	dc.overwriteLock.Lock()
	dc.manualOverwrite = nil
	dc.overwriteLock.Unlock()

	log := log.From(ctx)
	ctx, cancel := context.WithTimeout(ctx, time.Second*10)
	defer cancel()

	if err := dc.door.Unlock(ctx); err != nil {
		log.Errorf("failed to unlock door: %s", err)
	}

	time.Sleep(time.Second * 2)
	if err := dc.door.Lock(ctx); err != nil {
		log.Errorf("failed to unlock door: %s", err)
	}

	time.Sleep(time.Second * 2)
	if err := dc.door.Unlock(ctx); err != nil {
		log.Errorf("failed to unlock door: %s", err)
	}

}

func (dc *DoorController) scheduler() {
	defer dc.wg.Done()
	var lastState DoorState
	var state DoorState

	const maxTriesLocked = 60
	const maxTriesUnlocked = 20

	retries := 0
	maxTries := maxTriesLocked
	// trigger immediately
	var until time.Time = time.Now().Add(time.Second)

	for {
		ctx := context.Background()

		select {
		case <-dc.stop:
			return
		case hard := <-dc.reset:
			if hard != resetSoft {
				// reset the door state. it will unlock for a second or so.
				dc.resetDoor(ctx)
			}
			// force applying the door state.
			lastState = DoorState("")
		case <-time.After(time.Until(until)):

		// resend lock commands periodically as the door
		// might be open and may thus miss commands.
		case <-time.After(time.Minute):
		}

		ctx, cancel := context.WithTimeout(ctx, time.Second)

		var resetInProgress bool
		state, until, resetInProgress = dc.Current(ctx)

		// a reset may never be in progress at this point (because only this loop
		// executes a reset and it must have finished already)
		if resetInProgress {
			log.From(ctx).Errorf("BUG: a door reset is expected to be false")
		}

		if until.IsZero() {
			until = time.Now().Add(time.Minute * 5)
		}

		if state != lastState {
			retries = 0

			switch state {
			case Locked:
				maxTries = maxTriesLocked
			case Unlocked:
				maxTries = maxTriesUnlocked
			}
		}

		// only trigger when we need to change state.
		if retries < maxTries {
			retries++

			var err error
			switch state {
			case Locked:
				err = dc.Lock(ctx)
			case Unlocked:
				err = dc.Unlock(ctx)
			default:
				log.From(ctx).Errorf("invalid door state returned by Current(): %s", string(state))
				cancel()
				continue
			}

			if err != nil {
				log.From(ctx).Errorf("failed to set desired door state %s: %s", string(state), err)
			} else {
				lastState = state
			}

		}
		cancel()
	}
}

// ChangeOnDuty returns the time at which the doctor-on-duty changes
// and the given date. It makes sure d is in the correct timezone.
// Note that ChangeOnDuty requires the Weekday of d which might differ
// depending on t's zone information. The caller must make sure to have
// t in the desired time zone!
func (dc *DoorController) ChangeOnDuty(ctx context.Context, d time.Time) *ChangeOnCall {
	if d.Location() == time.UTC {
		log.From(ctx).Errorf("WARNING: ChnageOnDuty called with time in UTC")
	}

	change, ok := dc.changeOnDuty[d.Weekday()]
	if !ok {
		log.From(ctx).Errorf("no time for change-on-duty configured for %s (%d)", d.Weekday(), d)
		return nil
	}
	return change
}

// Current returns the current door state.
func (dc *DoorController) Current(ctx context.Context) (DoorState, time.Time, bool) {
	state, until := dc.stateFor(ctx, time.Now().In(dc.location))

	return state, until, dc.resetInProgress.IsSet()
}

// StateFor returns the desired door state for the time t.
// It makes sure t is in the correct location. Like in ChangeOnDuty, the
// caller must make sure that t is in the desired timezone as StateFor will copy
// hour and date information.
func (dc *DoorController) StateFor(ctx context.Context, t time.Time) (DoorState, time.Time) {
	return dc.stateFor(ctx, t)
}

func (dc *DoorController) stateFor(ctx context.Context, t time.Time) (DoorState, time.Time) {
	log := log.From(ctx)
	// if we have an active overwrite we need to return it
	// together with it's end time.
	if overwrite := dc.getManualOverwrite(); overwrite != nil && overwrite.until.After(t) {
		log.Infof("using manual door overwrite %q by %q until %s", overwrite.state, overwrite.sessionUser, overwrite.until)
		return overwrite.state, overwrite.until
	}

	// we need one frame because we might be in the middle
	// of it or before it.
	upcoming := dc.findUpcomingFrames(ctx, t, 1)
	if len(upcoming) == 0 {
		return Locked, time.Time{} // forever locked as there are no frames ...
	}

	f := upcoming[0]

	// if we are t is covered by f than should be unlocked
	// until the end of f.
	if f.Covers(t) {
		return Unlocked, f.To
	}

	// Otherwise there's no active frame so we are locked until
	// f starts.
	return Locked, f.From
}

// OpeningFramesForDay returns a list of openinghours on the day specified by t.
func (dc *DoorController) OpeningFramesForDay(ctx context.Context, t time.Time) []OpeningHour {
	t = t.In(dc.location)

	log := log.From(ctx)
	key := fmt.Sprintf("%02d/%02d", t.Month(), t.Day())

	// First we check for date specific overwrites ...
	ranges, ok := dc.dateSpecificHours[key]
	if ok {
		return ranges
	}

	// Check if we need to use holiday ranges ...
	isHoliday, err := dc.holidays.IsHoliday(ctx, dc.country, t)
	if err != nil {
		isHoliday = false
		log.Errorf("failed to load holidays: %s", err.Error())
	}
	if isHoliday {
		return dc.holidayTimeRanges
	}

	// Finally use the regular opening hours
	ranges, ok = dc.regularOpeningHours[t.Weekday()]
	if ok {
		return ranges
	}

	// There are no ranges for that day!
	log.V(4).Logf("No opening hour ranges found for %s", t)
	return nil
}

func (dc *DoorController) findUpcomingFrames(ctx context.Context, t time.Time, limit int) []utils.TimeRange {
	log := log.From(ctx)
	var result []utils.TimeRange

	// Nothing to search for if there aren't any regular opening hours.
	// There could be some holiday-only or date-specific hours but that's rather a
	// configuration issue.
	if len(dc.regularOpeningHours) == 0 {
		log.Errorf("no regular opening hours configured")
		return nil
	}

	for len(result) < limit {
		ranges := dc.OpeningFramesForDay(ctx, t)

		// Find the first frame that's after or covers t
		var idx int
		found := false
		for idx = range ranges {
			tr := ranges[idx].At(t, dc.location)
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
				tr := d.At(t, dc.location)
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

func (dc *DoorController) getManualOverwrite() *stateOverwrite {
	dc.overwriteLock.Lock()
	defer dc.overwriteLock.Unlock()

	return dc.manualOverwrite
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

func isValidState(state DoorState) error {
	switch state {
	case Locked, Unlocked:
		return nil
	}

	return fmt.Errorf("invalid door state: %s", state)
}
