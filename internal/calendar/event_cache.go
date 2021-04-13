package calendar

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/logger"
	"google.golang.org/api/calendar/v3"
)

type eventCache struct {
	rw            sync.RWMutex
	minTime       time.Time
	syncToken     string
	location      *time.Location
	firstLoadDone chan struct{}

	calID  string
	events []Event
	svc    *calendar.Service
}

func (ec *eventCache) String() string {
	return fmt.Sprintf("Cache<%s>", ec.calID)
}

func newCache(ctx context.Context, id string, loc *time.Location, svc *calendar.Service) (*eventCache, error) {
	cache := &eventCache{
		calID:         id,
		svc:           svc,
		location:      loc,
		firstLoadDone: make(chan struct{}),
	}

	go cache.watch(ctx)
	<-cache.firstLoadDone

	return cache, nil
}

func (ec *eventCache) watch(ctx context.Context) {
	waitTime := time.Minute
	firstLoad := true
	for {
		success := ec.loadEvents(ctx, !firstLoad)
		if success {
			waitTime = time.Minute
		} else {
			// in case of consecutive failures do some exponential backoff
			waitTime = 2 * waitTime
		}

		if firstLoad {
			firstLoad = false
			close(ec.firstLoadDone)
		}

		ec.evictFromCache(ctx)

		select {
		case <-ctx.Done():
			return
		case <-time.After(waitTime):
		}
	}
}

func (ec *eventCache) loadEvents(ctx context.Context, emit bool) bool {
	ec.rw.Lock()
	defer ec.rw.Unlock()

	call := ec.svc.Events.List(ec.calID)
	if ec.syncToken == "" {
		now := time.Now()
		ec.minTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, ec.location)
		call = call.ShowDeleted(false).SingleEvents(true).TimeMin(ec.minTime.Format(time.RFC3339))
	} else {
		call = call.SyncToken(ec.syncToken)
	}

	res, err := call.Do()
	if err != nil {
		log.From(ctx).Errorf("failed to pull events: %s", err)
		return false
	}

	ec.syncToken = res.NextSyncToken
	var events = make([]Event, len(res.Items))

	for idx, item := range res.Items {
		evt, err := convertToEvent(ctx, ec.calID, item)
		if err != nil {
			log.From(ctx).Errorf(err.Error())
			continue
		}
		events[idx] = *evt
	}

	ec.events = append(ec.events, events...)

	sort.Sort(ByStartTime(ec.events))

	log.From(ctx).WithFields(logger.Fields{
		"syncToken": ec.syncToken,
	}).Infof("loaded and cached %d new events", len(events))

	if emit {
		for _, evt := range events {
			eventID := fmt.Sprintf("event/calendar/%s/created", evt.CalendarID)
			event.Fire(ctx, eventID, evt)
		}
	}

	return true
}

func (ec *eventCache) evictFromCache(ctx context.Context) {
	ec.rw.Lock()
	defer ec.rw.Unlock()

	// TODO(ppacher): make cache limit configurable
	const threshold = 200

	if len(ec.events) < threshold {
		return
	}
	evictLimit := len(ec.events) - threshold

	now := time.Now()
	currentMidnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, ec.location)

	var idx int
	for idx = range ec.events {
		if ec.events[idx].StartTime.After(currentMidnight) {
			break
		}
		if idx > evictLimit {
			break
		}
	}

	if idx == 0 {
		log.From(ctx).V(8).Logf("cannot evict cache entries for today.")
		return
	}

	ec.events = ec.events[idx:]
	ec.minTime = ec.events[0].StartTime
	log.From(ctx).V(7).Logf("evicted %d events from cache which now starts with %s and holds %d events", idx, ec.minTime.Format(time.RFC3339), len(ec.events))
}

func (ec *eventCache) tryLoadFromCache(ctx context.Context, search *EventSearchOptions) ([]Event, bool) {
	// check if it's even possible to serve the request from cache.
	if search == nil {
		log.From(ctx).V(8).Logf("not using cache: search == nil")
		return nil, false
	}
	if search.from == nil {
		log.From(ctx).V(8).Logf("not using cache: search.from == nil")
		return nil, false
	}

	ec.rw.RLock()
	defer ec.rw.RUnlock()
	if search.from.Before(ec.minTime) && !ec.minTime.IsZero() {
		log.From(ctx).V(8).Logf("not using cache: search.from (%s) is before minTime (%s)", search.from, ec.minTime)
		return nil, false
	}

	var res []Event

	for _, evt := range ec.events {
		startInRange := search.from.Equal(evt.StartTime) || search.from.Before(evt.StartTime)
		if search.to != nil {
			startInRange = startInRange && (search.to.Equal(evt.StartTime) || search.to.After(evt.StartTime))
		}
		if startInRange {
			res = append(res, evt)
		}
	}

	log.From(ctx).V(7).Logf("loaded %d calendar events from cache", len(res))
	return res, true
}
