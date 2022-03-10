package door

// TODO(ppacher): move all the parsing work away from this package to schema or utils.

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tevino/abool"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/mqtt"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"go.opentelemetry.io/otel"
)

var log = pkglog.New("door")

// State describes the current state of the entry door.
type State string

// Interfacer is used to interact and control
// the entry door. The door itself may be locked,
// unlocked or "opened". If it's state is "opened",
// it will lock as soon as it closes.
type Interfacer interface {
	// Lock the door.
	Lock(context.Context) error

	// Unlock the door.
	Unlock(context.Context) error

	// Open the door for the next visitor to enter.
	Open(context.Context) error

	// Release is called to release and shut-down the door
	// interfacer.
	Release()
}

// Possible door states.
const (
	Locked   = State("locked")
	Unlocked = State("unlocked")
)

// Reset types.
var (
	resetSoft = (*struct{})(nil)
	resetHard = &struct{}{}
)

type stateOverwrite struct {
	state       State
	until       time.Time
	sessionUser string
}

// Controller interacts with the entry door controller via the configured interfacer
// and locks/unlocks the door depending on the opening hours.
type Controller struct {
	*openinghours.Controller

	// overwriteLock protects access to manualOverwrite.
	overwriteLock sync.Mutex

	// manualOverwrite is set when a user has manually overwritten
	// the current state of the entry door.
	manualOverwrite *stateOverwrite

	// stop is closed when the scheduler should stop.
	stop chan struct{}

	// reset triggers a reset of the scheduler.
	// A nil value means soft-reset while struct{}{}
	// is interpreted as a hard-reset causing a unlock-lock-unlock
	// sequence
	reset chan *struct{}

	// Whether or not a door reset is currently in progress.
	resetInProgress *abool.AtomicBool

	mqttConnectionManager *mqtt.ConnectionManager

	// wg is used to wait for door controller operations to finish.
	wg sync.WaitGroup

	// interfacerLock protects access to door
	interfacerLock sync.Mutex

	// door is the actual interface to control the door.
	door Interfacer
}

// NewDoorController returns a new door controller.
func NewDoorController(ctx context.Context, ohCtrl *openinghours.Controller, cs *runtime.ConfigSchema, mqttConnectionManager *mqtt.ConnectionManager) (*Controller, error) {
	dc := &Controller{
		Controller:            ohCtrl,
		stop:                  make(chan struct{}),
		reset:                 make(chan *struct{}),
		resetInProgress:       abool.NewBool(false),
		mqttConnectionManager: mqttConnectionManager,
		door:                  NoOp{},
	}

	cs.AddNotifier(dc, "Door")
	cs.AddValidator(dc, "Door")

	// initialize now
	all, err := cs.All(ctx, "Door")
	if err != nil {
		return nil, err
	}

	if len(all) > 0 {
		if err := dc.NotifyChange(ctx, "create", all[0].ID, &all[0].Section); err != nil {
			return nil, err
		}
	}

	// reset the scheduler whenever new opening hours got configured.
	dc.Controller.OnChange(func() {
		select {
		case dc.reset <- resetSoft:
		default:
		}
	})

	return dc, nil
}

func (dc *Controller) Validate(ctx context.Context, sec runtime.Section) error {
	var cfg MqttConfig
	if err := conf.DecodeSections([]conf.Section{sec.Section}, Spec, &cfg); err != nil {
		return err
	}

	cli, err := dc.mqttConnectionManager.Client(ctx, cfg.ConnectionName)
	if err != nil {
		return err
	}
	defer cli.Release()

	return nil
}

func (dc *Controller) NotifyChange(ctx context.Context, changeType, id string, sec *conf.Section) error {
	dc.interfacerLock.Lock()
	defer dc.interfacerLock.Unlock()

	// release the previously configured door interfacer
	if dc.door != nil {
		dc.door.Release()
	}

	dc.door = NoOp{}

	switch changeType {
	case "update", "create":
		var cfg MqttConfig
		if err := conf.DecodeSections([]conf.Section{*sec}, Spec, &cfg); err != nil {
			return err
		}

		cli, err := dc.mqttConnectionManager.Client(ctx, cfg.ConnectionName)
		if err != nil {
			return err
		}

		interfacer, err := NewMqttDoor(cli, cfg)
		if err != nil {
			return err
		}
		dc.door = interfacer
	}

	return nil
}

// Overwrite overwrites the current door state with state until untilTime.
func (dc *Controller) Overwrite(ctx context.Context, state State, untilTime time.Time) error {
	log.From(ctx).V(7).Logf("overwritting door state to %s until %s", state, untilTime)

	if err := isValidState(state); err != nil {
		return err
	}

	dc.overwriteLock.Lock()
	{
		dc.manualOverwrite = &stateOverwrite{
			state:       state,
			sessionUser: session.UserFromCtx(ctx),
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
func (dc *Controller) Lock(ctx context.Context) error {
	ctx, sp := otel.Tracer("").Start(ctx, "door.Controller.Lock")
	defer sp.End()

	eventDoorLock.Fire(ctx, nil)

	dc.wg.Add(1)
	defer dc.wg.Done()

	dc.interfacerLock.Lock()
	defer dc.interfacerLock.Unlock()

	if dc.door == nil {
		return fmt.Errorf("unconfigured door interfacer")
	}

	return dc.door.Lock(ctx)
}

// Unlock implements DoorInterfacer.
func (dc *Controller) Unlock(ctx context.Context) error {
	ctx, sp := otel.Tracer("").Start(ctx, "door.Controller.Unlock")
	defer sp.End()

	eventDoorUnlock.Fire(ctx, nil)

	dc.wg.Add(1)
	defer dc.wg.Done()

	dc.interfacerLock.Lock()
	defer dc.interfacerLock.Unlock()

	if dc.door == nil {
		return fmt.Errorf("unconfigured door interfacer")
	}

	return dc.door.Unlock(ctx)
}

// Open implements DoorInterfacer.
func (dc *Controller) Open(ctx context.Context) error {
	ctx, sp := otel.Tracer("").Start(ctx, "door.Controller.Open")
	defer sp.End()

	eventDoorOpen.Fire(ctx, nil)

	dc.wg.Add(1)
	defer dc.wg.Done()

	dc.interfacerLock.Lock()
	defer dc.interfacerLock.Unlock()

	if dc.door == nil {
		return fmt.Errorf("unconfigured door interfacer")
	}

	return dc.door.Open(ctx)
}

// Start starts the scheduler for the door controller.
func (dc *Controller) Start() error {
	dc.wg.Add(1)
	go dc.scheduler()

	return nil
}

// Stop requests the scheduler to stop and waits for all
// operations to complete.
func (dc *Controller) Stop() error {
	close(dc.stop)

	dc.wg.Wait()

	return nil
}

// Reset triggers a reset of the door scheduler.
func (dc *Controller) Reset(ctx context.Context) error {
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
func (dc *Controller) resetDoor(ctx context.Context) {
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

// trunk-ignore(golangci-lint/cyclop)
func (dc *Controller) scheduler() {
	defer dc.wg.Done()
	var lastState State
	var state State

	const maxTriesLocked = 60
	const maxTriesUnlocked = 20

	retries := 0
	maxTries := maxTriesLocked
	// trigger immediately
	until := time.Now().Add(time.Second)

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
			lastState = State("")
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

// Current returns the current door state.
func (dc *Controller) Current(ctx context.Context) (State, time.Time, bool) {
	state, until := dc.stateFor(ctx, time.Now().In(dc.Location()))

	return state, until, dc.resetInProgress.IsSet()
}

// StateFor returns the desired door state for the time t.
// It makes sure t is in the correct location. Like in ChangeOnDuty, the
// caller must make sure that t is in the desired timezone as StateFor will copy
// hour and date information.
func (dc *Controller) StateFor(ctx context.Context, t time.Time) (State, time.Time) {
	return dc.stateFor(ctx, t)
}

func (dc *Controller) stateFor(ctx context.Context, t time.Time) (State, time.Time) {
	log := log.From(ctx)
	// if we have an active overwrite we need to return it
	// together with it's end time.
	if overwrite := dc.getManualOverwrite(); overwrite != nil && overwrite.until.After(t) {
		log.Infof("using manual door overwrite %q by %q until %s", overwrite.state, overwrite.sessionUser, overwrite.until)

		return overwrite.state, overwrite.until
	}

	// we need one frame because we might be in the middle
	// of it or before it.
	upcoming := dc.UpcomingFrames(ctx, t, 1)
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

func (dc *Controller) getManualOverwrite() *stateOverwrite {
	dc.overwriteLock.Lock()
	defer dc.overwriteLock.Unlock()

	return dc.manualOverwrite
}

func isValidState(state State) error {
	switch state {
	case Locked, Unlocked:
		return nil
	}

	return fmt.Errorf("invalid door state: %s", state)
}
