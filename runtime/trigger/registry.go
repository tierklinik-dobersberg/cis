package trigger

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/service/runtime"
)

var log = pkglog.New("trigger")

// MatchConfig holds meta configuration for trigger instances
// when file-based trigger configuration is being used. MatchConfig
// defines the configuration that can be specified in the [Match]
// section of .trigger files. Refer to MatchSpec and Registry for
// more information about file-based trigger configuration.
type MatchConfig struct {
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
}

// Type is a trigger type with a set of supported configuration stanzas
// and a factory function. Type is a convenience type and implements Factory.
type Type struct {
	// OptionRegistry defines all supported configuration stanzas of the trigger
	// type.
	conf.OptionRegistry
	// CreateFunc should create a new handler. See Factory for more information.
	CreateFunc func(context.Context, *runtime.ConfigSchema, *conf.Section) (Handler, error)
}

// Create calls CreateFunc and implements Factory.
func (t *Type) Create(ctx context.Context, globalCfg *runtime.ConfigSchema, sec *conf.Section) (Handler, error) {
	return t.CreateFunc(ctx, globalCfg, sec)
}

type Factory interface {
	// OptionRegistry defines all supported configuration stanzas of the trigger
	// type.
	conf.OptionRegistry

	// Create should create a new handler. It's called for each section of
	// this trigger type in a .trigger configuration file. It may also use
	// configuration values from the runtime config schema (if any).
	Create(ctx context.Context, globalConfig *runtime.ConfigSchema, sec *conf.Section) (Handler, error)
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
type Registry struct {
	event     *event.Registry
	location  *time.Location
	l         sync.RWMutex
	factories map[string]Factory
}

// NewRegistry creates a new trigger registry that places and event subscriptions and
// eventReg. The optional timezone (location) is used for event deboucing and buffering.
// If location is nil it defaults to time.Local. Refer to InstanceConfig or MatchConfig
// for more information on debouncing and buffering of events.
func NewRegistry(eventReg *event.Registry, location *time.Location) *Registry {
	if location == nil {
		location = time.Local
	}
	return &Registry{
		factories: make(map[string]Factory),
		event:     eventReg,
		location:  location,
	}
}

// SetLocation changes the timezone for the trigger registry.
// Note that SetLocation does not lock the registry and must not
// be called concurrently with CreateTrigger or LoadFiles.
func (reg *Registry) SetLocation(loc *time.Location) {
	reg.location = loc
}

// TypeCount returns the number of trigger types that have been
// registered so far.
func (reg *Registry) TypeCount() int {
	reg.l.RLock()
	defer reg.l.RUnlock()

	return len(reg.factories)
}

// LoadFiles loads all .trigger files from path and creates new
// trigger instances. globalConfig is passed to each factory
// factory and may contain shared or optional configuration data.
// Note that LoadFiles aborts creating trigger instances as soon
// as an error is encountered.
//
// Note that any event subscriptions will be canceled together
// with ctx and automatic processing of events will be stopped.
func (reg *Registry) LoadFiles(ctx context.Context, globalConfig *runtime.ConfigSchema, path string) ([]*Instance, error) {
	files, err := conf.ReadDir(path, ".trigger", reg)
	if err != nil {
		return nil, err
	}

	instances := make([]*Instance, len(files))
	for idx, file := range files {
		i, err := reg.CreateTrigger(ctx, globalConfig, file)
		if err != nil {
			return instances, fmt.Errorf("%s: %s", file.Path, err)
		}
		instances[idx] = i
	}

	return instances, nil
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
	factory, ok := reg.factories[sec]
	if !ok {
		return nil, false
	}

	return factory, true
}

// CreateTrigger creates a new trigger instance from the configuration file f.
// It will create a new handler for each handler section found in the configuration
// and will subscribe to all event topics specified in the [Match] section. The
// event subscription will be cancelled as soon as ctx is cancelled.
func (reg *Registry) CreateTrigger(ctx context.Context, globalConfig *runtime.ConfigSchema, f *conf.File) (*Instance, error) {
	instanceCfg, err := reg.getInstanceCfg(f)
	if err != nil {
		return nil, err
	}

	// copy over the configured location.
	instanceCfg.Location = reg.location

	fileBase := filepath.Base(f.Path)
	fileBase = strings.TrimSuffix(fileBase, filepath.Ext(fileBase))

	reg.l.RLock()
	defer reg.l.RUnlock()

	// now iterate over all sections, call the associated factory and collect
	// the created handlers.
	var handlers []Handler
	for idx := range f.Sections {
		sec := f.Sections[idx]

		// we already parsed the [Match] section so we can skip
		// it.
		if strings.EqualFold(sec.Name, "Match") {
			continue
		}

		factory, ok := reg.factories[strings.ToLower(sec.Name)]
		if !ok {
			return nil, fmt.Errorf("found unknown trigger action %q", sec.Name)
		}

		handler, err := factory.Create(ctx, globalConfig, &sec)
		if err != nil {
			return nil, fmt.Errorf("failed creating trigger handler for %s: %w", sec.Name, err)
		}
		handlers = append(handlers, handler)
	}

	instance := NewInstance(fileBase, handlers, instanceCfg)

	reg.subscribeAndDispatch(ctx, instance, fileBase)

	return instance, nil
}

func (reg *Registry) getInstanceCfg(f *conf.File) (*InstanceConfig, error) {
	matchSecs := f.Sections.GetAll("Match")
	if len(matchSecs) != 1 {
		return nil, fmt.Errorf("expected exactly one [Match] section but found %d", len(matchSecs))
	}
	var match MatchConfig
	if err := conf.DecodeSections(matchSecs, MatchSpec, &match); err != nil {
		return nil, fmt.Errorf("failed to parse [Match] section: %w", err)
	}
	instanceCfg, err := matchToInstanceConfig(match)
	if err != nil {
		return nil, err
	}
	return instanceCfg, nil
}

func (reg *Registry) subscribeAndDispatch(ctx context.Context, instance *Instance, namePrefix string) {
	// finally, subscribe to events and dispatch them to the handlers
	for idx, filter := range instance.cfg.EventFilters {
		instanceName := fmt.Sprintf("%s-%02d", namePrefix, idx)
		ch := reg.event.Subscribe(instanceName, filter)

		go func(filter string) {
			defer reg.event.Unsubscribe(instanceName, filter)
			for {
				select {
				case msg := <-ch:
					go instance.Handle(ctx, msg)
				case <-ctx.Done():
					return
				}
			}
		}(filter)
	}
}

// RegisterType registers a new handler type under name. The name is
// used to as the handlers section name and must be unique. If another
// handler with name is already registered an error is returned.
func (reg *Registry) RegisterType(name string, factory Factory) error {
	name = strings.ToLower(name)

	reg.l.Lock()
	defer reg.l.Unlock()

	if _, ok := reg.factories[name]; ok {
		return fmt.Errorf("trigger handler type %s already registered", name)
	}

	reg.factories[name] = factory

	return nil
}

// RegisterType is a shortcut for using DefaultRegistry.RegisterType.
func RegisterType(name string, factory Factory) error {
	return DefaultRegistry.RegisterType(name, factory)
}

// DefaultRegistry is a trigger registry that is configured for the
// default event registry.
var DefaultRegistry = NewRegistry(event.DefaultRegistry, time.Local)
