package trigger

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/logger"
)

// InstanceConfig holds additional configuration values
// for trigger handler instances.
type InstanceConfig struct {
	DebounceUntil []utils.DayTime
	BufferUntil   []utils.DayTime
	Location      *time.Location
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

	return instanceCfg, nil
}

// Instances wraps a trigger type handler and adds
// additional methods like buffering and debouncing
// of events.
type Instance struct {
	cfg     *InstanceConfig
	handler Handler
	name    string

	l         sync.Mutex
	buffer    []*event.Event
	startOnce sync.Once
}

// NewInstance creates a new trigger instance for handler.
func NewInstance(instanceName string, handler Handler, instanceCfg *InstanceConfig) *Instance {
	return &Instance{
		cfg:     instanceCfg,
		name:    instanceName,
		handler: handler,
	}
}

func (inst *Instance) Handle(ctx context.Context, evt *event.Event) {
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
		return
	}

	// Direct passthrough to the handler if neither BufferUntil= or
	// DebounceUntil= is set.
	inst.handler.HandleEvents(ctx, evt)
}

func (inst *Instance) waitAndFire(ctx context.Context) {
	frames := inst.cfg.BufferUntil
	if len(frames) == 0 {
		frames = inst.cfg.DebounceUntil
	}

	for {
		select {
		case <-time.After(30 * time.Second):
		case <-ctx.Done():
			return
		}

		// TODO(ppacher): better just block until we actually need
		// to do something.
		shouldFire := false
		now := time.Now()
		nowStr := now.Format("2006-01-02 15:04")
		for _, frame := range frames {
			fireTime := frame.At(now, inst.cfg.Location).Format("2006-01-02 15:04")
			if fireTime == nowStr {
				shouldFire = true
				break
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

	inst.l.Lock()
	defer inst.l.Unlock()

	if len(inst.buffer) == 0 {
		log.V(7).Logf("buffer empty, skipping BufferUntil= / DebounceUntil=")
		return
	}

	log.V(7).Logf("fireing %d buffered events", len(inst.buffer))
	inst.handler.HandleEvents(context.Background(), inst.buffer...)
	inst.buffer = nil
}
