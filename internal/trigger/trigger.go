package trigger

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/event"
)

// MatchSpec defines all configuration stanzas that
// are available in each [Match] section
var MatchSpec = conf.SectionSpec{
	{
		Name:        "EventFilter",
		Type:        conf.StringSliceType,
		Aliases:     []string{"Event"},
		Description: "A event subscription topic",
		Default:     "#",
	},
}

// MatchConfig is the parsed form of a [Match] section in
// .trigger files.
type MatchConfig struct {
	EventFilter []string
}

// Handler handles events fired by the event registry the
// handler's factory is attached.
type Handler interface {
	HandleEvent(event *event.Event)
}

type Type struct {
	conf.OptionRegistry
	CreateFunc func(context.Context, *conf.Section) (Handler, error)
}

// Create calls CreateFunc and implements Factory.
func (t *Type) Create(ctx context.Context, sec *conf.Section) (Handler, error) {
	return t.CreateFunc(ctx, sec)
}

type Factory interface {
	conf.OptionRegistry

	// Create creates a new trigger handler from the given
	// section.
	Create(ctx context.Context, sec *conf.Section) (Handler, error)
}

type Registry struct {
	event *event.Registry

	l         sync.RWMutex
	factories map[string]Factory
}

func NewRegistry(eventReg *event.Registry) *Registry {
	return &Registry{
		factories: make(map[string]Factory),
	}
}

// LoadFiles loads all .trigger files from path.
func (reg *Registry) LoadFiles(ctx context.Context, path string) error {
	files, err := conf.ReadDir(path, ".trigger", reg)
	if err != nil {
		return err
	}

	for _, file := range files {
		if err := reg.CreateTrigger(ctx, file); err != nil {
			return fmt.Errorf("%s: %s", file.Path, err)
		}
	}

	return nil
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
func (reg *Registry) CreateTrigger(ctx context.Context, f *conf.File) error {
	matchSecs := f.Sections.GetAll("Match")
	if len(matchSecs) != 1 {
		return fmt.Errorf("expected exactly one [Match] section but found %d", len(matchSecs))
	}

	var match MatchConfig
	if err := conf.DecodeSections(matchSecs, MatchSpec, match); err != nil {
		return fmt.Errorf("failed to parse [Match] section: %s", err)
	}

	reg.l.RLock()
	defer reg.l.RUnlock()

	var handlers []Handler

	// now iterate over all sections and call the associated factory
	for _, sec := range f.Sections {
		// we already parsed the [Match] section so we can skip
		// it.
		if strings.EqualFold(sec.Name, "Match") {
			continue
		}

		factory, ok := reg.factories[strings.ToLower(sec.Name)]
		if !ok {
			return fmt.Errorf("found unknown trigger action %q", sec.Name)
		}

		handler, err := factory.Create(ctx, &sec)
		if err != nil {
			return fmt.Errorf("failed creating trigger handler for %s", sec.Name)
		}
		handlers = append(handlers, handler)
	}

	// finally, subscribe to events and dispatch them to the handlers
	for idx, filter := range match.EventFilter {
		instanceName := fmt.Sprintf("%s-%02d", filepath.Base(f.Path), idx)
		ch := reg.event.Subscribe(instanceName, filter)

		go func() {
			// TODO(ppacher): add context so we can cancel this one.
			for msg := range ch {
				for _, handler := range handlers {
					go handler.HandleEvent(msg)
				}
			}
		}()
	}

	return nil
}

// RegisterHandlerType registers a new handler type.
func (reg *Registry) RegisterHandlerType(name string, factory Factory) error {
	reg.l.Lock()
	defer reg.l.Unlock()

	if _, ok := reg.factories[name]; ok {
		return fmt.Errorf("Trigger handler type %s already registered", name)
	}

	reg.factories[name] = factory

	return nil
}

// MustRegisterHandlerType is like RegisterHandlerType but panics in case
// of an error.
func (reg *Registry) MustRegisterHandlerType(name string, factory Factory) {
	if err := reg.RegisterHandlerType(name, factory); err != nil {
		panic(err)
	}
}

// RegisterHandlerType is a shortcut for using DefaultRegistry.RegisterHandlerType.
func RegisterHandlerType(name string, factory Factory) error {
	return DefaultRegistry.RegisterHandlerType(name, factory)
}

// MustRegisterHandlerType is a shortcut for using DefaultRegistry.MustRegisterHandlerType.
func MustRegisterHandlerType(name string, factory Factory) {
	DefaultRegistry.MustRegisterHandlerType(name, factory)
}

// DefaultRegistry is a trigger registry that is configured for the
// default event registry.
var DefaultRegistry = NewRegistry(event.DefaultRegistry)
