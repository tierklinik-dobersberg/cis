package runtime

import (
	"fmt"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
)

type (
	// ConfigSchema defines the allowed sections for a configuration
	// file.
	ConfigSchema struct {
		rw           sync.RWMutex
		sections     conf.FileSpec
		descriptions map[string]string

		fileLock sync.RWMutex
		file     *conf.File
	}

	// ConfigSchemaBuilder collects functions that add configuration
	// sections to a configuration scheme. It's to allow code to be used
	// with mutliple configuration schemes while still being allowed to
	// register on the global configuration.
	ConfigSchemaBuilder []func(*ConfigSchema) error
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

// RegisterSection registers a section at the global config registry.
func (schema *ConfigSchema) RegisterSection(name string, description string, sec conf.OptionRegistry) error {
	lowerName := strings.ToLower(name)

	schema.rw.Lock()
	defer schema.rw.Unlock()
	if _, ok := schema.sections[lowerName]; ok {
		return fmt.Errorf("section with name %q already registered", name)
	}
	if schema.sections == nil {
		schema.sections = make(conf.FileSpec)
		schema.descriptions = make(map[string]string)
	}
	schema.sections[lowerName] = sec
	schema.descriptions[lowerName] = description
	return nil
}

// OptionsForSection implements conf.SectionRegistry.
func (schema *ConfigSchema) OptionsForSection(name string) (conf.OptionRegistry, bool) {
	schema.rw.RLock()
	defer schema.rw.RUnlock()
	if schema.sections == nil {
		return nil, false
	}
	return schema.sections.OptionsForSection(name)
}

// Decode decodes the values of section from into target.
func (schema *ConfigSchema) Decode(section string, target interface{}) error {
	schema.fileLock.RLock()
	defer schema.fileLock.RUnlock()

	if schema.file == nil {
		return fmt.Errorf("configuration not loaded")
	}

	spec, ok := schema.sections.OptionsForSection(section)
	if !ok {
		return conf.ErrUnknownSection
	}
	return conf.DecodeSections(schema.file.GetAll(section), spec, target)
}

// SetFile sets the parsed configuration file for the schema.
func (schema *ConfigSchema) SetFile(file *conf.File) {
	schema.fileLock.Lock()
	defer schema.fileLock.Unlock()
	schema.file = file
}

// GlobalSchema is the global configuration schema.
var GlobalSchema = new(ConfigSchema)
