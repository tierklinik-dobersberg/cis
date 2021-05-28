package trigger

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
)

// Handler is the interface that can be attached to trigger instances and
// can handle and react to different kinds of events. For configuration
// based triggers it's possible to register Handler factories and their
// supported configuration stanzas at the trigger registry. See Registry
// for more information on file based trigger configuration.
type Handler interface {
	// HandleEvents is called for each set of events fired. There might
	// be multiple events if the users configures BufferUntil.
	HandleEvents(ctx context.Context, event ...*event.Event)
}

// InstanceConfig holds additional configuration values
// for trigger instances.
type InstanceConfig struct {
	// EventFilters holds a topic subscription that's evaluated using
	// event.MatchSubscription. It's only used when calling Wants() on the
	// final instance returned by NewInstance. This field is not required
	// and only for convenience purpopses when manually triggering instances
	// using Handle().
	EventFilters []string
	// DebounceUntil can be set to different day-times (minute resolution)
	// until which the handling of events is debounced. A trigger instance
	// that is currently debouncing events and waiting for the next "until"
	// time returns true from Pending(). Trigger instances with DebounceUntil=
	// will never fire more than one event at the specified day times and never
	// fire in between.
	//
	// Note that DebounceUntil and BufferUntnil are mutually exclusive.
	// Configuring both will cause NewInstance to return an error.
	DebounceUntil []utils.DayTime
	// BufferUntil works similar to DebounceUntil but instead of dropping older
	// events and just keeping the latest one BufferUntil keeps track of all
	// events that occured between the configured day times. Once a day time is
	// reached with minute resolution, the complete buffer of events is handed to
	// each handler of the instance.
	//
	// Note that DebounceUntil and BufferUntnil are mutually exclusive.
	// Configuring both will cause NewInstance to return an error.
	BufferUntil []utils.DayTime
	// Location may defined the timezone the instance should operate in. The
	// timezone is mainly required if DebounceUntil or BufferUntil is configured.
	Location *time.Location
	// Description holds an optional, human-readable description
	Description string
}

// Instance is a dedicated trigger instance that handles a set of events
// and executes specified handlers for each of them. Instances may directly
// forward events to their handlers or buffer/debounce them until certain
// conditions apply. See InstanceConfig for more information on deboucing and
// buffering.
type Instance struct {
	cfg      *InstanceConfig
	handlers []Handler
	name     string

	l         sync.Mutex
	buffer    []*event.Event
	startOnce sync.Once
	pending   bool
	flush     chan struct{}
}

// NewInstance creates a new trigger instance for the set of handlers.
// Note that the instance does not listen for events by itself. The caller
// will want to make sure to call Handle(*event.Event) at appropriate
// places or create a event subscription.
func NewInstance(instanceName string, handlers []Handler, instanceCfg *InstanceConfig) *Instance {
	return &Instance{
		cfg:      instanceCfg,
		name:     instanceName,
		handlers: handlers,
		pending:  false,
		flush:    make(chan struct{}),
	}
}

// Name returns the name of the instance.
func (inst *Instance) Name() string {
	return inst.name
}

// Description returns the description of the trigger
// instance or an empty string.
func (inst *Instance) Description() string {
	return inst.cfg.Description
}

// Pending returns true if events are pending to be handled
// by the instance. Pending can only return true if the instance
// has either DebounceUntil or BufferUntil configured.
func (inst *Instance) Pending() bool {
	inst.l.Lock()
	defer inst.l.Unlock()

	return inst.pending
}

// Flush forces execution of all instance handlers. It returns
// true if execution was trigger and false if not. Note that even
// if execution has been triggered it's not guaranteed that events
// have been pending as Flush only triggers the goroutine to check if
// work needs to be done. The instance must have DebounceUntil or
// BufferUntil configured to be flushable. Otherwise Flush will always
// return false.
func (inst *Instance) Flush() bool {
	select {
	case inst.flush <- struct{}{}:
		return true
	default:
		return false
	}
}

// Wants checks if one of the instance event filters matches
// eventTopic.
func (inst *Instance) Wants(eventTopic string) bool {
	for _, f := range inst.cfg.EventFilters {
		if event.MatchSubscription(eventTopic, f) {
			return true
		}
	}
	return false
}

// Handle should be called whenever the trigger instance should handle
// an event. Depending on the instance configuration the event might
// be directly passed to the set of event handlers or might be debounced
// or buffered until certain points in time. Refer to the documentation of
// Instance and InstanceConfig for more information on buffering and
// debouncing of events. Note that handle does not check if the provided
// event matches on of the EventFilters specified for this instance. The
// caller should use Wants() before or otherwise make sure this instance
// can handle the provided event.
func (inst *Instance) Handle(ctx context.Context, evt *event.Event) {
	// if we're buffering or debouncing event handling we need a separate
	// goroutine and will fill / overwrite the instance buffer.
	if len(inst.cfg.BufferUntil) > 0 || len(inst.cfg.DebounceUntil) > 0 {
		inst.startOnce.Do(func() {
			ctx := logger.WithFields(context.TODO(), logger.Fields{
				"tigger": inst.name,
			})
			go inst.waitAndFire(ctx)
		})

		inst.l.Lock()
		defer inst.l.Unlock()
		if len(inst.cfg.BufferUntil) > 0 {
			inst.buffer = append(inst.buffer, evt)
		} else {
			inst.buffer = []*event.Event{evt}
		}
		inst.pending = true

		return
	}

	// Direct passthrough to the handlers if neither BufferUntil= nor
	// DebounceUntil= is set.
	for _, handler := range inst.handlers {
		handler.HandleEvents(ctx, evt)
	}
}

func (inst *Instance) waitAndFire(ctx context.Context) {
	frames := inst.cfg.BufferUntil
	if len(frames) == 0 {
		frames = inst.cfg.DebounceUntil
	}

	for {
		shouldFire := false
		select {
		case <-time.After(30 * time.Second):
		case <-ctx.Done():
			return
		case <-inst.flush:
			shouldFire = true
		}

		// if we are not being flushed we may need to fire
		// if BufferUntil= / DebounceUntil= time is reached.
		if !shouldFire {
			now := time.Now()
			nowStr := now.Format("2006-01-02 15:04")
			for _, frame := range frames {
				fireTime := frame.At(now, inst.cfg.Location).Format("2006-01-02 15:04")
				if fireTime == nowStr {
					shouldFire = true
					break
				}
			}
		}

		if !shouldFire {
			continue
		}

		inst.fireBuffer(ctx)
	}
}

func (inst *Instance) fireBuffer(ctx context.Context) {
	log := log.From(ctx)

	defer func() {
		if x := recover(); x != nil {
			log.Errorf("recovered from trigger panic: %v", x)
		}
	}()

	inst.l.Lock()
	defer inst.l.Unlock()

	inst.pending = false
	if len(inst.buffer) == 0 {
		log.V(7).Logf("buffer empty, skipping BufferUntil= / DebounceUntil=")
		return
	}

	// reset the buffer immediately so we get rid of any event that might
	// cause a panic in one of the handlers below.
	buffer := inst.buffer
	inst.buffer = nil

	log.V(7).Logf("fireing %d buffered events", len(buffer))
	for _, handler := range inst.handlers {
		handler.HandleEvents(context.Background(), buffer...)
	}
}

func matchToInstanceConfig(match MatchConfig) (*InstanceConfig, error) {
	instanceCfg := new(InstanceConfig)
	for _, dt := range match.DebounceUntil {
		val, err := utils.ParseDayTime(dt)
		if err != nil {
			return nil, fmt.Errorf("invalid value %q for DebounceUntil= : %w", dt, err)
		}
		instanceCfg.DebounceUntil = append(instanceCfg.DebounceUntil, val)
	}

	for _, dt := range match.BufferUntil {
		val, err := utils.ParseDayTime(dt)
		if err != nil {
			return nil, fmt.Errorf("invalid value %q for BufferUntil= : %w", dt, err)
		}
		instanceCfg.BufferUntil = append(instanceCfg.BufferUntil, val)
	}

	if len(instanceCfg.BufferUntil) > 0 && len(instanceCfg.DebounceUntil) > 0 {
		return nil, fmt.Errorf("DebounceUntil= and BufferUntil= are mutually exclusive")
	}

	instanceCfg.Location = time.Local
	instanceCfg.EventFilters = match.EventFilter
	instanceCfg.Description = match.Description

	return instanceCfg, nil
}
