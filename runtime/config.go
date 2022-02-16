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
		entries map[string]Schema

		providerLock sync.RWMutex
		provider     ConfigProvider
	}

	// ConfigSchemaBuilder collects functions that add configuration
	// sections to a configuration scheme. It's to allow code to be used
	// with mutliple configuration schemes while still being allowed to
	// register on the global configuration.
	ConfigSchemaBuilder []func(*ConfigSchema) error

	// Schema is passed to ConfigSchema.Register and holds metadata and information
	// about the registered configuration block.
	Schema struct {
		// Name is the name of the registration block and is used to identify the allowed
		// values of a configuration.
		// Name is required when registering a new configuration block.
		Name string `json:"name"`

		// DisplayName holds a human readable name for the schema type and is mainly used
		// in the user interface. If omitted, DisplayName is set to equal Name.
		DisplayName string `json:"displayName"`

		SVGData string `json:"svgData,omitempty"`

		// Description holds a human readable description of the configuration block and
		// is mainly used by the user interface.
		// Description is optional.
		Description string `json:"description"`

		// Category defines the category the configuration section belongs to.
		// Categories can be used to group related sections together in the user
		// interface.
		Category string `json:"category"`

		// Spec holds the actual option registry that defines which values and which types
		// are allowed for instances of the configuration block.
		// Spec is required when registering a new configuration block.
		Spec conf.OptionRegistry `json:"-"`

		// Multi should be set to true if multiple instances of the registered
		// configuration can exist at the same time.
		Multi bool `json:"multi"`

		// OnChange is called when an instance of a specific configuration section
		// is created, modified or deleted. The changeType parameter will be set to
		// "create", "update" or "delete" respectively with id holding a unique identifier
		// for the section. Note that sec is only set for create or update operations but MAY
		// be omitted during deletes.
		// Note that any error returned from this callback is displayed to the user but does
		// NOT prevent that change from happening!
		OnChange func(ctx context.Context, changeType, id string, sec *conf.Section) error `json:"-"`
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
func (schema *ConfigSchema) Register(regs ...Schema) error {
	schema.rw.Lock()
	defer schema.rw.Unlock()

	for idx, reg := range regs {
		if reg.Name == "" {
			return fmt.Errorf("index %d: %w", idx, ErrMissingName)
		}
		lowerName := strings.ToLower(reg.Name)

		if reg.DisplayName == "" {
			reg.DisplayName = reg.Name
		}

		if reg.Spec == nil {
			return fmt.Errorf("%s: %w", reg.Name, ErrMissingSpec)
		}

		if _, ok := schema.entries[lowerName]; ok {
			return fmt.Errorf("%s: %w", reg.Name, ErrNameTaken)
		}

		if schema.entries == nil {
			schema.entries = make(map[string]Schema)
		}
		schema.entries[lowerName] = reg
	}

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

// Schemas returns a slice of all registered configuration schemas.
func (schema *ConfigSchema) Schemas() []Schema {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	res := make([]Schema, 0, len(schema.entries))
	for _, value := range schema.entries {
		res = append(res, value)
	}
	return res
}

func (schema *ConfigSchema) SchemaAsMap(ctx context.Context, name string) (map[string]map[string]interface{}, error) {
	lower := strings.ToLower(name)
	spec, ok := schema.entries[lower]
	if !ok {
		return nil, ErrCfgSectionNotFound
	}

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return nil, ErrNoProvider
	}

	configs, err := schema.provider.Get(ctx, name)
	if err != nil {
		return nil, err
	}

	decoder := conf.NewSectionDecoder(spec.Spec.All())
	result := make(map[string]map[string]interface{}, len(configs))
	for _, sec := range configs {
		result[sec.ID] = decoder.AsMap(sec.Section)
	}
	return result, nil
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

// DecodeSection decodes the values of section from into target.
func (schema *ConfigSchema) DecodeSection(ctx context.Context, section string, target interface{}) error {
	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return ErrNoProvider
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

func (schema *ConfigSchema) GetID(ctx context.Context, id string) (Section, error) {
	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return Section{}, ErrNoProvider
	}

	sec, err := schema.provider.GetID(ctx, id)
	return sec, err
}

func (schema *ConfigSchema) Create(ctx context.Context, secType string, options []conf.Option) (string, error) {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	reg, ok := schema.entries[strings.ToLower(secType)]
	if !ok {
		return "", ErrCfgSectionNotFound
	}

	if schema.provider == nil {
		return "", ErrNoProvider
	}

	id, err := schema.provider.Create(ctx, conf.Section{
		Name:    secType,
		Options: options,
	})
	if err != nil {
		return "", err
	}

	if reg.OnChange != nil {
		if err := reg.OnChange(ctx, "create", id, &conf.Section{
			Name:    secType,
			Options: options,
		}); err != nil {
			return id, &NotificationError{Wrapped: err}
		}
	}
	return id, err
}

func (schema *ConfigSchema) Update(ctx context.Context, id, secType string, opts []conf.Option) error {
	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	schema.rw.RLock()
	defer schema.rw.RUnlock()

	if schema.provider == nil {
		return ErrNoProvider
	}

	reg, ok := schema.entries[strings.ToLower(secType)]
	if !ok {
		return ErrCfgSectionNotFound
	}

	if err := schema.provider.Update(ctx, id, secType, opts); err != nil {
		return err
	}

	if reg.OnChange != nil {
		if err := reg.OnChange(ctx, "delete", id, &conf.Section{
			Name:    secType,
			Options: opts,
		}); err != nil {
			return &NotificationError{Wrapped: err}
		}
	}
	return nil
}

func (schema *ConfigSchema) Delete(ctx context.Context, id string) error {
	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return ErrNoProvider
	}

	val, err := schema.provider.GetID(ctx, id)
	if err != nil {
		return err
	}

	schema.rw.RLock()
	defer schema.rw.RUnlock()

	reg, ok := schema.entries[strings.ToLower(val.Name)]
	if !ok {
		return ErrCfgSectionNotFound
	}

	if err := schema.provider.Delete(ctx, id); err != nil {
		return err
	}

	if reg.OnChange != nil {
		if err := reg.OnChange(ctx, "delete", val.ID, &val.Section); err != nil {
			return &NotificationError{Wrapped: err}
		}
	}
	return nil
}

// GlobalSchema is the global configuration schema.
var GlobalSchema = new(ConfigSchema)
