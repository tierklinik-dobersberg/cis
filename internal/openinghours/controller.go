package openinghours

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/ppacher/system-conf/conf"
	calendarv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/calendar/v1"
	"github.com/tierklinik-dobersberg/apis/gen/go/tkd/calendar/v1/calendarv1connect"
	commonv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/common/v1"
	"github.com/tierklinik-dobersberg/apis/pkg/discovery/consuldiscover"
	"github.com/tierklinik-dobersberg/apis/pkg/discovery/wellknown"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var log = pkglog.New("openinghours")

type (
	// ChangeNotifyFunc can be registered at the Controller to get notified
	// when new opening hours have been configured.
	ChangeNotifyFunc func()

	// Controller keeps track of opening hours.
	Controller struct {
		rw       sync.RWMutex
		notifier []ChangeNotifyFunc

		location *time.Location

		// country is the country we are operating in and is required
		// to retrieve the correct list of public holidays.
		country string

		holidays calendarv1connect.HolidayServiceClient

		state *state
	}
)

// New returns a new opening hour controller.
func New(ctx context.Context, cfg cfgspec.Config, globalSchema *runtime.ConfigSchema) (*Controller, error) {
	loc, err := time.LoadLocation(cfg.TimeZone)
	if err != nil {
		return nil, fmt.Errorf("option Location: %w", err)
	}

	disc, err := consuldiscover.NewFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to get consul service catalog: %w", err)
	}

	holidays, err := wellknown.HolidayService.Create(ctx, disc)
	if err != nil {
		return nil, fmt.Errorf("failed to get holiday service client: %w", err)
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

	var errs []error

	newState := ctrl.state.clone()

	// we delete for "delete" and "update".
	if changeType != "create" {
		if err := newState.deleteOpeningHour(ctx, openingHour.id); err != nil {
			errs = append(errs, fmt.Errorf("failed to delete: %w", err))
		}
	}

	// we "create" for "create" and "update".
	if changeType != "delete" {
		if err := newState.addOpeningHours(ctx, openingHour); err != nil {
			errs = append(errs, fmt.Errorf("failed to create: %w", err))
		}
	}

	if err := errors.Join(errs...); err != nil {
		return err
	}

	ctrl.state = newState

	// notify all subscribers that we got new opening hours
	for _, fn := range ctrl.notifier {
		fn()
	}

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

func (ctrl *Controller) UpcomingFrames(ctx context.Context, dateTime time.Time, limit int) []daytime.TimeRange {
	ctrl.rw.RLock()
	defer ctrl.rw.RUnlock()

	var result []daytime.TimeRange

	for len(result) < limit {
		ranges := ctrl.forDate(ctx, dateTime)

		if len(ranges) == 0 {
			break
		}

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
	if len(result) > limit {
		return result[0:limit]
	}

	return result
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
	isHoliday, err := ctrl.holidays.IsHoliday(ctx, connect.NewRequest(&calendarv1.IsHolidayRequest{
		Date: &commonv1.Date{
			Year:  int64(date.Year()),
			Month: commonv1.Month(date.Month()),
			Day:   int32(date.Day()),
		},
	}))

	if err != nil {
		log.Errorf("failed to load holidays: %s", err.Error())
	} else if isHoliday.Msg.IsHoliday {
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

// OnChange registers fn to be called whenever the configured opening
// hours change.
func (ctrl *Controller) OnChange(fn ChangeNotifyFunc) {
	ctrl.rw.Lock()
	defer ctrl.rw.Unlock()

	ctrl.notifier = append(ctrl.notifier, fn)
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

	return nil
}
