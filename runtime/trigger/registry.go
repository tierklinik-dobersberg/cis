package trigger

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var log = pkglog.New("trigger")

type (
	// MatchConfig holds meta configuration for trigger instances
	// when file-based trigger configuration is being used. MatchConfig
	// defines the configuration that can be specified in the [Match]
	// section of .trigger files. Refer to MatchSpec and Registry for
	// more information about file-based trigger configuration.
	MatchConfig struct {
		// Name is the name of the trigger instance as set by the user.
		Name string
		// EventFitler may hold multiple event topic subscriptions.
		// The trigger instance created from this MatchConfig handles
		// each event that matches one of the specified filters.
		EventFilter []string
		// BufferUntil configures the day-times until which events should
		// be buffered and emitted at once. Refer to the documentation of
		// InstanceConfig for more information on event buffering.
		//
		// Note that BufferUntil and DebounceUntil are mutally exclusive.
		BufferUntil []string
		// Debounce configures the day-times until which events should
		// be debounced and only the last one should be emitted.
		// Refer to the documentation of InstanceConfig for more information
		// on event debouncing.
		//
		// Note that BufferUntil and DebounceUntil are mutally exclusive.
		DebounceUntil []string
		// Description holds an optional, human-readable description
		Description string
		// Group is a list of group names the trigger instance belongs to
		Group []string
		// Condition is a maja42/goval condition that must evaluate to true.
		Condition string
	}

	Definition struct {
		ID      string
		Match   []conf.Option
		Actions []runtime.Section
	}

	ActionType struct {
		runtime.Schema

		// CreateFunc is called when a new instance of the trigger handler should be created.
		CreateFunc func(ctx context.Context, globalSchema *runtime.ConfigSchema, sec *conf.Section) (Handler, error) `json:"-"`
	}

	// Registry manages trigger type factories and supports file based trigger
	// configuration using ppacher/system-conf. It loads trigger configuration
	// units (<name>.trigger) from the filesystem and creates a trigger instance
	// for each file loaded. The trigger file must have a [Match] section that
	// follows MatchSpec and one or more handler sections where the section is
	// named after the handler type (passed to RegisterType). For example, the
	// following .trigger file creates a new instance that will execute two
	// different handles when a matching event is fired:
	//   [Match]
	//   EventFilter=events/notifications/#
	//
	//   [SendMail]
	//   To=that@guy.mail
	//   From=noc@example.com
	//   Subject=A new notification arrived
	//
	//   [Exec]
	//   StreamEventToStdin=json
	//   Exec=/usr/local/bin/handle-event.sh $1
	//
	// Registry also implements conf.SectionRegistry and may be directly used
	// to validate .trigger files.
	Registry struct {
		// trunk-ignore(golangci-lint/containedctx)
		baseCtx     context.Context
		event       *event.Registry
		location    *time.Location
		l           sync.RWMutex
		cs          *runtime.ConfigSchema
		actionTypes map[string]ActionType

		instances map[string]*Instance
	}
)

// NewRegistry creates a new trigger registry that places and event subscriptions and
// eventReg. The optional timezone (location) is used for event deboucing and buffering.
// If location is nil it defaults to time.Local. Refer to InstanceConfig or MatchConfig
// for more information on debouncing and buffering of events.
func NewRegistry(baseCtx context.Context, eventReg *event.Registry, location *time.Location, cs *runtime.ConfigSchema) *Registry {
	if location == nil {
		location = time.Local
	}

	return &Registry{
		actionTypes: make(map[string]ActionType),
		event:       eventReg,
		location:    location,
		cs:          cs,
		instances:   make(map[string]*Instance),
		baseCtx:     baseCtx,
	}
}

// EventRegistry returns the event registry this trigger registry is bounded
// to.
func (reg *Registry) EventRegistry() *event.Registry {
	return reg.event
}

func (reg *Registry) LoadAndCreate(ctx context.Context) error {
	// load TriggerInstance from reg.cs, get config for each entry of TriggerAction (by ID)
	// and create instance.
	// TODO(ppacher): update "CreateTrigger" to store in reg.cs

	all, err := reg.ListTriggers(ctx)
	if err != nil {
		return fmt.Errorf("failed to load triggers: %w", err)
	}

	errs := new(multierr.Error)
	for _, def := range all {
		if _, err := reg.newTriggerInstance(ctx, def); err != nil {
			errs.Addf("failed to create instance for %s: %w", def.ID, err)
		}
	}

	return errs.ToError()
}

// ActionTypes returns all available action types.
func (reg *Registry) ActionTypes() []ActionType {
	reg.l.RLock()
	defer reg.l.RUnlock()

	result := make([]ActionType, 0, len(reg.actionTypes))
	for _, reg := range reg.actionTypes {
		result = append(result, reg)
	}

	return result
}

// OptionsForSection returns the option registry for the trigger file
// section sec. It implements the conf.SectionRegistry interface. Note that
// the MatchSpec is automatically added for [Match] sections.
func (reg *Registry) OptionsForSection(sec string) (conf.OptionRegistry, bool) {
	if sec == "match" {
		return MatchSpec, true
	}

	reg.l.RLock()
	defer reg.l.RUnlock()
	factory, ok := reg.actionTypes[sec]
	if !ok {
		return nil, false
	}

	return factory.Spec, true
}

func (reg *Registry) ListTriggers(ctx context.Context) ([]Definition, error) {
	ctx, sp := otel.Tracer("").Start(ctx, "trigger.Registry.ListTriggers")
	defer sp.End()

	sections, err := reg.cs.All(ctx, "TriggerInstance")
	if err != nil {
		return nil, fmt.Errorf("failed to get trigger instances: %w", err)
	}

	triggers := make([]Definition, 0, len(sections))

	for _, sec := range sections {
		def, err := reg.GetTrigger(ctx, sec.ID)
		if err != nil {
			return nil, err
		}

		triggers = append(triggers, def)
	}

	return triggers, nil
}

func (reg *Registry) GetTrigger(ctx context.Context, triggerID string) (Definition, error) {
	ctx, sp := otel.Tracer("").Start(ctx, "trigger.Registry.GetTrigger",
		trace.WithAttributes(
			attribute.String("trigger_id", triggerID),
		),
	)
	defer sp.End()

	sec, err := reg.cs.GetID(ctx, triggerID)
	if err != nil {
		return Definition{}, fmt.Errorf("failed to load trigger definition %s: %w", triggerID, err)
	}

	actionIDs := sec.Section.GetStringSlice("Action")
	actions := make([]runtime.Section, len(actionIDs))
	for idx, actionID := range actionIDs {
		actionOpts, err := reg.cs.GetID(ctx, actionID)
		if err != nil {
			logger.From(ctx).Errorf("failed to load action configuration %s: %w", actionID, err)

			continue
		}

		actions[idx] = actionOpts
	}

	return Definition{
		ID:      triggerID,
		Match:   sec.Options,
		Actions: actions,
	}, nil
}

func (reg *Registry) PutTrigger(ctx context.Context, def Definition) (string, error) {
	ctx, sp := otel.Tracer("").Start(ctx, "trigger.Registry.PutTrigger",
		trace.WithAttributes(
			attribute.String("trigger_id", def.ID),
		),
	)
	defer sp.End()

	if def.ID != "" {
		// stop the currently running trigger instance.
		reg.stopInstance(ctx, def.ID)

		existing, err := reg.GetTrigger(ctx, def.ID)
		if err != nil {
			return "", fmt.Errorf("failed to get existing trigger %s: %w", def.ID, err)
		}
		reg.deleteTriggerActions(ctx, existing)
	}

	// create each action definition
	for idx, act := range def.Actions {
		var err error
		def.Actions[idx].ID, err = reg.cs.Create(ctx, act.Name, act.Options)
		if err != nil {
			return "", fmt.Errorf("failed to create action definition for type %s: %w", act.Name, err)
		}
	}

	// construct a new valid []conf.Option for the Match section that only includes
	// the new action IDs
	newMatchOpts := make([]conf.Option, 0, len(def.Match)+len(def.Actions))
	for _, opt := range def.Match {
		if opt.Name == "Action" {
			continue
		}
		newMatchOpts = append(newMatchOpts, opt)
	}
	for _, act := range def.Actions {
		newMatchOpts = append(newMatchOpts, conf.Option{
			Name:  "Action",
			Value: act.ID,
		})
	}

	def.Match = newMatchOpts

	// if we have a trigger instance ID this is actually an update.
	if def.ID != "" {
		if err := reg.cs.Update(ctx, def.ID, "TriggerInstance", def.Match); err != nil {
			return "", fmt.Errorf("failed to update trigger instance %s: %w", def.ID, err)
		}

	} else {
		// otherwise create a new trigger entry.
		var err error
		def.ID, err = reg.cs.Create(ctx, "TriggerInstance", def.Match)
		if err != nil {
			return "", fmt.Errorf("failed to create trigger instance: %w", err)
		}
	}

	if _, err := reg.newTriggerInstance(ctx, def); err != nil {
		return "", fmt.Errorf("failed to create trigger: %s", err)
	}

	return def.ID, nil
}

func (reg *Registry) DeleteTrigger(ctx context.Context, defID string) error {
	ctx, sp := otel.Tracer("").Start(ctx, "trigger.Registry.DeleteTrigger",
		trace.WithAttributes(
			attribute.String("trigger_id", defID),
		),
	)
	defer sp.End()

	reg.stopInstance(ctx, defID)

	existing, err := reg.GetTrigger(ctx, defID)
	if err != nil {
		sp.RecordError(err)

		return fmt.Errorf("failed to get existing trigger %s: %w", defID, err)
	}

	reg.deleteTriggerActions(ctx, existing)

	// delete the trigger instance itself
	if err := reg.cs.Delete(ctx, defID); err != nil {
		sp.RecordError(err)

		return fmt.Errorf("failed to delete: %w", err)
	}

	return nil
}

func (reg *Registry) stopInstance(ctx context.Context, defID string) {
	reg.l.Lock()
	defer reg.l.Unlock()

	instance, ok := reg.instances[defID]
	if ok {
		if instance.cancel != nil {
			instance.cancel()
			instance.wg.Wait()
		} else {
			log.From(ctx).Infof("failed to cancel trigger instance, no CancelFunc available")
			trace.SpanFromContext(ctx).AddEvent(
				fmt.Sprintf("trigger instance %s does not have a CancelFunc", defID),
			)
		}
		delete(reg.instances, defID)
	} else {
		trace.SpanFromContext(ctx).AddEvent(
			fmt.Sprintf("no trigger cancelable instance found with id %s", defID),
		)
	}
}

func (reg *Registry) deleteTriggerActions(ctx context.Context, def Definition) {
	// delete all actions that
	for _, act := range def.Actions {
		if err := reg.cs.Delete(ctx, act.ID); err != nil {
			if err != nil {
				logger.From(ctx).Errorf("failed to delete action for updated trigger %s: %w", act.ID, err)

				continue
			}
		}
	}
}

// newTriggerInstnace creates a new trigger instance from the configuration file f.
// It will create a new handler for each handler section found in the configuration
// and will subscribe to all event topics specified in the [Match] section. The
// event subscription will be cancelled as soon as ctx is cancelled.
func (reg *Registry) newTriggerInstance(ctx context.Context, def Definition) (*Instance, error) {
	instanceCfg, err := reg.getInstanceCfg(def)
	if err != nil {
		return nil, err
	}

	// copy over the configured location.
	instanceCfg.Location = reg.location

	reg.l.Lock()
	defer reg.l.Unlock()

	// now iterate over all sections, call the associated factory and collect
	// the created handlers.
	handlers := make([]Handler, 0, len(def.Actions))
	for idx := range def.Actions {
		sec := def.Actions[idx]

		factory, ok := reg.actionTypes[strings.ToLower(sec.Name)]
		if !ok {
			return nil, fmt.Errorf("found unknown trigger action %q", sec.Name)
		}

		handler, err := factory.CreateFunc(ctx, reg.cs, &sec.Section)
		if err != nil {
			return nil, fmt.Errorf("failed creating trigger handler for %s: %w", sec.Name, err)
		}
		handlers = append(handlers, handler)
	}

	instanceCtx, instance := NewInstance(reg.baseCtx, def.ID, handlers, instanceCfg)

	reg.instances[instance.id] = instance

	// trunk-ignore(golangci-lint/contextcheck)
	reg.subscribeAndDispatch(instanceCtx, instance)

	return instance, nil
}

func (reg *Registry) Instances() []*Instance {
	reg.l.RLock()
	defer reg.l.RUnlock()

	instances := make([]*Instance, 0, len(reg.instances))
	for _, i := range reg.instances {
		instances = append(instances, i)
	}

	sort.Sort(byInstanceName(instances))

	return instances
}

func (reg *Registry) getInstanceCfg(def Definition) (*InstanceConfig, error) {
	var match MatchConfig
	if err := conf.DecodeSections(conf.Sections{
		{
			Name:    "Match",
			Options: def.Match,
		},
	}, MatchSpec, &match); err != nil {
		return nil, fmt.Errorf("failed to parse trigger configuration: %w", err)
	}
	instanceCfg, err := matchToInstanceConfig(match)
	if err != nil {
		return nil, err
	}

	return instanceCfg, nil
}

func (reg *Registry) subscribeAndDispatch(ctx context.Context, instance *Instance) {
	// finally, subscribe to events and dispatch them to the handlers
	instance.wg.Add(len(instance.cfg.EventFilters))

	for idx, filter := range instance.cfg.EventFilters {
		instanceName := fmt.Sprintf("%s-%02d", instance.id, idx)
		ch := reg.event.Subscribe(instanceName, filter)

		go func(filter string) {
			defer instance.wg.Done()
			defer reg.event.Unsubscribe(instanceName, filter)

			for {
				select {
				case msg := <-ch:
					go func(msg *event.Event) {
						ctx, sp := otel.Tracer("").Start(ctx, "cis:triger:event-handler")
						defer sp.End()

						if err := instance.Handle(ctx, msg); err != nil {
							logger.From(ctx).Errorf("trigger instance %s failed to handle event: %w", instance.id, err)
						}
					}(msg)
				case <-ctx.Done():
					return
				}
			}
		}(filter)
	}
}

// RegisterType registers a new trigger factory and the respective configuration
// schema. The schema is registered at the runtime.ConfigSchema that has been
// used when creating the trigger registry.
//
// It automatically overwrites a few properties of the schema registration
// like marking the schema as "multi" and "Internal".
func (reg *Registry) RegisterType(factory ActionType) error {
	name := strings.ToLower(factory.Name)

	factory.Internal = true
	factory.Multi = true

	reg.l.Lock()
	defer reg.l.Unlock()

	if _, ok := reg.actionTypes[name]; ok {
		return fmt.Errorf("trigger handler type %s already registered", name)
	}

	if err := reg.cs.Register(factory.Schema); err != nil {
		return err
	}

	reg.actionTypes[name] = factory

	return nil
}

func (reg *Registry) GetType(name string) (ActionType, error) {
	reg.l.RLock()
	defer reg.l.RUnlock()

	act, ok := reg.actionTypes[strings.ToLower(name)]
	if ok {
		return act, nil
	}

	return ActionType{}, fmt.Errorf("unknown action type %s", name)
}

type byInstanceName []*Instance

func (sl byInstanceName) Len() int           { return len(sl) }
func (sl byInstanceName) Swap(i, j int)      { sl[i], sl[j] = sl[j], sl[i] }
func (sl byInstanceName) Less(i, j int) bool { return sl[i].id < sl[j].id }
