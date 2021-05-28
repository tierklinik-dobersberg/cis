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

// MatchConfig is the parsed form of a [Match] section in
// .trigger files.
type MatchConfig struct {
	EventFilter   []string
	BufferUntil   []string
	DebounceUntil []string
}

// Handler handles events fired by the event registry.
type Handler interface {
	// HanldeEvents is called for each set of events fired. There might
	// be multiple events if the users configures a BufferUntil or BufferTime.
	HandleEvents(ctx context.Context, event ...*event.Event)
}

type Type struct {
	conf.OptionRegistry
	CreateFunc func(context.Context, *runtime.ConfigSchema, *conf.Section) (Handler, error)
}

// Create calls CreateFunc and implements Factory.
func (t *Type) Create(ctx context.Context, globalCfg *runtime.ConfigSchema, sec *conf.Section) (Handler, error) {
	return t.CreateFunc(ctx, globalCfg, sec)
}

type Factory interface {
	conf.OptionRegistry

	// Create creates a new trigger handler from the given
	// section.
	Create(ctx context.Context, globalConfig *runtime.ConfigSchema, sec *conf.Section) (Handler, error)
}

type Registry struct {
	event     *event.Registry
	location  *time.Location
	l         sync.RWMutex
	factories map[string]Factory
}

func NewRegistry(eventReg *event.Registry, location *time.Location) *Registry {
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

// LoadFiles loads all .trigger files from path.
func (reg *Registry) LoadFiles(ctx context.Context, globalConfig *runtime.ConfigSchema, path string) ([]*Instance, error) {
	files, err := conf.ReadDir(path, ".trigger", reg)
	if err != nil {
		return nil, err
	}

	instances := make([]*Instance, len(files))
	for idx, file := range files {
		i, err := reg.CreateTrigger(ctx, globalConfig, file)
		if err != nil {
			return nil, fmt.Errorf("%s: %s", file.Path, err)
		}
		instances[idx] = i
	}

	return instances, nil
}

// OptionsForSection returns the option registry for the trigger file
// section sec. It implements the conf.SectionRegistry interface.
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

// CreateTrigger creates a new trigger from a file defintion.
func (reg *Registry) CreateTrigger(ctx context.Context, globalConfig *runtime.ConfigSchema, f *conf.File) (*Instance, error) {
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

	// copy over the configured location.
	instanceCfg.Location = reg.location

	fileBase := filepath.Base(f.Path)
	fileBase = strings.TrimSuffix(fileBase, filepath.Ext(fileBase))

	reg.l.RLock()
	defer reg.l.RUnlock()

	// now iterate over all sections, call the associated factory and collect
	// the created handlers.
	var handlers []Handler
	for _, sec := range f.Sections {
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

	// finally, subscribe to events and dispatch them to the handlers
	for idx, filter := range match.EventFilter {
		instanceName := fmt.Sprintf("%s-%02d", filepath.Base(f.Path), idx)
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

	return instance, nil
}

// RegisterHandlerType registers a new handler type.
func (reg *Registry) RegisterHandlerType(name string, factory Factory) error {
	reg.l.Lock()
	defer reg.l.Unlock()

	if _, ok := reg.factories[name]; ok {
		return fmt.Errorf("trigger handler type %s already registered", name)
	}

	reg.factories[name] = factory

	return nil
}

// RegisterHandlerType is a shortcut for using DefaultRegistry.RegisterHandlerType.
func RegisterHandlerType(name string, factory Factory) error {
	return DefaultRegistry.RegisterHandlerType(name, factory)
}

// DefaultRegistry is a trigger registry that is configured for the
// default event registry.
var DefaultRegistry = NewRegistry(event.DefaultRegistry, time.Local)
