package runtime

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
)

var (
	CategoryNotifications = "vet.dobersberg.cis/schema/category/notifications"
)

type (
	// ConfigSchema defines the allowed sections for a configuration
	// file.
	ConfigSchema struct {
		rw      sync.RWMutex
		entries map[string]Registration

		providerLock sync.RWMutex
		provider     ConfigProvider
	}

	// ConfigSchemaBuilder collects functions that add configuration
	// sections to a configuration scheme. It's to allow code to be used
	// with mutliple configuration schemes while still being allowed to
	// register on the global configuration.
	ConfigSchemaBuilder []func(*ConfigSchema) error

	// Registration is passed to ConfigSchema.Register and holds metadata and information
	// about the registered configuration block.
	Registration struct {
		// Name is the name of the registration block and is used to identify the allowed
		// values of a configuration.
		// Name is required when registering a new configuration block.
		Name string

		// Description holds a human readable description of the configuration block and
		// is mainly used by the user interface.
		// Description is optional.
		Description string

		// Category defines the category the configuration section belongs to.
		// Categories can be used to group related sections together in the user
		// interface.
		Category string

		// Spec holds the actual option registry that defines which values and which types
		// are allowed for instances of the configuration block.
		// Spec is required when registering a new configuration block.
		Spec conf.OptionRegistry

		// Multi should be set to true if multiple instances of the registered
		// configuration can exist at the same time.
		Multi bool

		// OnChange is called when an instance of a specific configuration section
		// is created, modified or deleted. The changeType parameter will be set to
		// "create", "update" or "delete" respectively with id holding a unique identifier
		// for the section. Note that sec is only set for create or update operations but MAY
		// be omitted during deletes.
		// Note that any error returned from this callback is displayed to the user but does
		// NOT prevent that change from happening!
		OnChange func(ctx context.Context, changeType, id string, sec *conf.Section) error
	}
)

// NewConfigSchemaBuilder returns a new config schema builder using funcs.
func NewConfigSchemaBuilder(funcs ...func(s *ConfigSchema) error) ConfigSchemaBuilder {
	var csb ConfigSchemaBuilder

	csb.Register(funcs...)

	return csb
}

// Register adds a config schema setup function to the list.
func (csb *ConfigSchemaBuilder) Register(funcs ...func(*ConfigSchema) error) {
	for _, f := range funcs {
		*csb = append(*csb, f)
	}
}

// AddToSchema applies all functions from csb to scheme. It aborts if non-nil
// error is returned.
func (csb *ConfigSchemaBuilder) AddToSchema(scheme *ConfigSchema) error {
	for _, f := range *csb {
		if err := f(scheme); err != nil {
			return err
		}
	}
	return nil
}

var (
	ErrMissingName = errors.New("config-schema: registration is missing a unique name")
	ErrNameTaken   = errors.New("config-schema: registration name already in use")
	ErrMissingSpec = errors.New("config-schema: registration is missing configuration specification")
)

// Register registers a section at the global config registry.
func (schema *ConfigSchema) Register(reg Registration) error {
	if reg.Name == "" {
		return ErrMissingName
	}
	lowerName := strings.ToLower(reg.Name)

	if reg.Spec == nil {
		return ErrMissingSpec
	}

	schema.rw.Lock()
	defer schema.rw.Unlock()
	if _, ok := schema.entries[lowerName]; ok {
		return ErrNameTaken
	}
	if schema.entries == nil {
		schema.entries = make(map[string]Registration)
	}
	schema.entries[lowerName] = reg

	return nil
}

// FileSpec returns the current file spec described by the config schema.
func (schema *ConfigSchema) FileSpec() conf.FileSpec {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	c := conf.FileSpec{}
	for sec, spec := range schema.entries {
		c[sec] = spec.Spec
	}

	return c
}

// OptionsForSection implements conf.SectionRegistry.
func (schema *ConfigSchema) OptionsForSection(name string) (conf.OptionRegistry, bool) {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	if schema.entries == nil {
		return nil, false
	}

	lower := strings.ToLower(name)
	reg, ok := schema.entries[lower]
	if !ok {
		return nil, false
	}
	return reg.Spec, true
}

// Decode decodes the values of section from into target.
func (schema *ConfigSchema) Decode(ctx context.Context, section string, target interface{}) error {
	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return fmt.Errorf("configuration not loaded")
	}

	spec, ok := schema.OptionsForSection(section)
	if !ok {
		return conf.ErrUnknownSection
	}

	sections, err := schema.provider.Get(ctx, section)
	if err != nil {
		return err
	}
	s := make([]conf.Section, len(sections))
	for idx, sec := range sections {
		s[idx] = sec.Section
	}
	return conf.DecodeSections(s, spec, target)
}

// SetFileProvider sets the parsed configuration file for the schema.
func (schema *ConfigSchema) SetFileProvider(file *conf.File) {
	schema.providerLock.Lock()
	defer schema.providerLock.Unlock()

	schema.provider = &FileProvider{File: file}
}

// GlobalSchema is the global configuration schema.
var GlobalSchema = new(ConfigSchema)
