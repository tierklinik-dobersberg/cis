package identity

import (
	"context"
	"errors"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
)

var (
	ErrIdentifierTaken  = errors.New("provider identifier already used")
	ErrUnknownProvider  = errors.New("unknown provider type")
	ErrMultipleSections = errors.New("multiple configuration sections found")
)

type (
	// Factory creates a new identity provider using the given configuration section.
	Factory interface {
		CreateProvider(ctx context.Context, global *cfgspec.Config, cfg conf.Section) (Provider, error)
	}

	// FactoryFunc is a convenience type for implementing the Factory interface.
	FactoryFunc func(ctx context.Context, global *cfgspec.Config, cfg conf.Section) (Provider, error)

	// Registry keeps track of available identity provider factories and their configuration
	// specification.
	Registry struct {
		l         sync.Mutex
		factories map[string]registryEntry
	}

	registryEntry struct {
		Factory
		Spec conf.OptionRegistry
	}
)

// CreateProvider implements the Factory interface and creates a new identity provider
// using the provided cfg section.
func (fn FactoryFunc) CreateProvider(ctx context.Context, global *cfgspec.Config, cfg conf.Section) (Provider, error) {
	return fn(ctx, global, cfg)
}

// Register registers a new provider factory and the corresponding configuration specification.
func (reg *Registry) Register(name string, spec conf.OptionRegistry, factory Factory) error {
	name = strings.ToLower(name)

	reg.l.Lock()
	defer reg.l.Unlock()

	if reg.factories == nil {
		reg.factories = make(map[string]registryEntry)
	}

	if _, ok := reg.factories[name]; ok {
		return ErrIdentifierTaken
	}

	reg.factories[name] = registryEntry{
		Factory: factory,
		Spec:    spec,
	}
	return nil
}

// Create creates a new identity provider from the given type and initializes it
// using cfg.
func (reg *Registry) Create(ctx context.Context, providerTypoe string, global *cfgspec.Config, cfg *conf.File) (Provider, error) {
	reg.l.Lock()
	defer reg.l.Unlock()

	if reg.factories == nil {
		return nil, ErrUnknownProvider
	}
	entry, ok := reg.factories[strings.ToLower(providerTypoe)]
	if !ok {
		return nil, ErrUnknownProvider
	}

	cfgSections := cfg.GetAll(providerTypoe)
	if len(cfgSections) > 1 {
		return nil, ErrMultipleSections
	}
	var providerConfig conf.Section
	if len(cfgSections) == 1 {
		providerConfig = cfgSections[0]
	}

	return entry.CreateProvider(ctx, global, providerConfig)
}

// OptionsForSection implements the conf.SectionRegistry interface. That is, a Registry
// can be directly used to validate configuration sections of registered providers.
func (reg *Registry) OptionsForSection(name string) (conf.OptionRegistry, bool) {
	name = strings.ToLower(name)

	reg.l.Lock()
	defer reg.l.Unlock()

	if reg.factories == nil {
		return nil, false
	}

	entry, ok := reg.factories[name]
	if ok {
		return entry.Spec, ok
	}
	return nil, false
}

// DefaultRegistry is the default registry exported by this package and used
// by package-level APIs
var DefaultRegistry = new(Registry)

// compile time check if we correctly satisfy the SectionRegistry interface.
var _ conf.SectionRegistry = new(Registry)
