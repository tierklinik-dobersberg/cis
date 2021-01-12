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

	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/logger"
)

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

	// wg is used to wait for door controller operations to finish.
	wg sync.WaitGroup
}

// NewDoorController returns a new door controller.
func NewDoorController(cfg schema.Config, timeRanges []schema.OpeningHours, holidays HolidayGetter, door DoorInterfacer) (*DoorController, error) {
	dc := &DoorController{
		country:             cfg.Country,
		holidays:            holidays,
		regularOpeningHours: make(map[time.Weekday][]OpeningHour),
		dateSpecificHours:   make(map[string][]OpeningHour),
		door:                door,
		stop:                make(chan struct{}),
		reset:               make(chan *struct{}),
	}

	for _, c := range timeRanges {
		var (
			days  []time.Weekday
			dates []string
		)

		for _, d := range c.OnWeekday {
			if err := schema.ValidDay(d); err != nil {
				return nil, err
			}

			parsed, ok := schema.ParseDay(d)
			if !ok {
				return nil, fmt.Errorf("failed to parse day: %s", d)
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
func (dc *DoorController) resetDoor() {
	dc.wg.Add(1)
	defer dc.wg.Done()

	// remove any manual overwrite when we do a reset.
	dc.overwriteLock.Lock()
	dc.manualOverwrite = nil
	dc.overwriteLock.Unlock()

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Second*10)
	defer cancel()

	if err := dc.door.Unlock(ctx); err != nil {
		logger.Errorf(ctx, "failed to unlock door: %s", err)
	}

	time.Sleep(time.Second * 2)
	if err := dc.door.Lock(ctx); err != nil {
		logger.Errorf(ctx, "failed to unlock door: %s", err)
	}

	time.Sleep(time.Second * 2)
	if err := dc.door.Unlock(ctx); err != nil {
		logger.Errorf(ctx, "failed to unlock door: %s", err)
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
		select {
		case <-dc.stop:
			return
		case hard := <-dc.reset:
			if hard != resetSoft {

				// reset the door state. it will unlock for a second or so.
				dc.resetDoor()
			}
			// force applying the door state.
			lastState = DoorState("")
		case <-time.After(time.Until(until)):

		// resend lock commands periodically as the door
		// might be open and may thus miss commands.
		case <-time.After(time.Minute):
		}

		ctx, cancel := context.WithTimeout(context.Background(), time.Second)

		state, until = dc.Current(ctx)
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

			switch state {
			case Locked:
				dc.Lock(ctx)
			case Unlocked:
				dc.Unlock(ctx)
			default:
				logger.Errorf(ctx, "invalid door state returned by Current(): %s", string(state))
				cancel()
				continue
			}

			lastState = state
		}
		cancel()
	}
}

// Current returns the current door state.
func (dc *DoorController) Current(ctx context.Context) (DoorState, time.Time) {
	return dc.stateFor(ctx, time.Now())
}

// StateFor returns the desired door state for the time t.
func (dc *DoorController) StateFor(ctx context.Context, t time.Time) (DoorState, time.Time) {
	return dc.stateFor(ctx, t)
}

func (dc *DoorController) stateFor(ctx context.Context, t time.Time) (DoorState, time.Time) {
	// if we have an active overwrite we need to return it
	// together with it's end time.
	if overwrite := dc.getManualOverwrite(); overwrite != nil && overwrite.until.After(t) {
		logger.Infof(ctx, "using manual door overwrite %q by %q until %s", overwrite.state, overwrite.sessionUser, overwrite.until)
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

func (dc *DoorController) getRangesForDay(ctx context.Context, t time.Time) []OpeningHour {
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
		logger.Errorf(ctx, "failed to load holidays: %s", err.Error())
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
	logger.Infof(ctx, "No opening hour ranges found for %s", t)
	return nil
}

func (dc *DoorController) findUpcomingFrames(ctx context.Context, t time.Time, limit int) []utils.TimeRange {
	var result []utils.TimeRange

	// Nothing to search for if there aren't any regular opening hours.
	// There could be some holiday-only or date-specific hours but that's rather a
	// configuration issue.
	if len(dc.regularOpeningHours) == 0 {
		logger.Errorf(ctx, "no regular opening hours configured")
		return nil
	}

	for len(result) < limit {
		ranges := dc.getRangesForDay(ctx, t)

		// Find the first frame that's after or covers t
		var idx int
		found := false
		for idx = range ranges {
			tr := ranges[idx].At(t)
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
				tr := d.At(t)
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
