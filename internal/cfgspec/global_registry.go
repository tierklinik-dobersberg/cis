package cfgspec

import (
	"fmt"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
)

// GlobalConfigRegistry keeps track of global
// configuration sections.
type GlobalConfigRegistry struct {
	rw           sync.RWMutex
	sections     conf.FileSpec
	descriptions map[string]string
}

// RegisterSection registers a section at the global config registry.
func (gcr *GlobalConfigRegistry) RegisterSection(name string, descr string, sec conf.OptionRegistry) error {
	lowerName := strings.ToLower(name)

	gcr.rw.Lock()
	defer gcr.rw.Unlock()
	if _, ok := gcr.sections[lowerName]; ok {
		return fmt.Errorf("section with name %q already registered", name)
	}
	if gcr.sections == nil {
		gcr.sections = make(conf.FileSpec)
		gcr.descriptions = make(map[string]string)
	}
	gcr.sections[lowerName] = sec
	gcr.descriptions[lowerName] = descr
	return nil
}

// OptionsForSection implements conf.SectionRegistry.
func (gcr *GlobalConfigRegistry) OptionsForSection(name string) (conf.OptionRegistry, bool) {
	gcr.rw.RLock()
	defer gcr.rw.RUnlock()
	if gcr.sections == nil {
		return nil, false
	}
	return gcr.sections.OptionsForSection(name)
}

// Get returns decodes the values of section from f into target.
func (gcr *GlobalConfigRegistry) Get(f *conf.File, section string, target interface{}) error {
	spec, ok := gcr.sections.OptionsForSection(section)
	if !ok {
		return conf.ErrUnknownSection
	}
	return conf.DecodeSections(f.GetAll(section), spec, target)
}

// RegisterGlobalSection registers the configuration section sec with name
// at DefaultRegistry.
func RegisterGlobalSection(name string, descr string, sec conf.OptionRegistry) error {
	return DefaultRegistry.RegisterSection(name, descr, sec)
}

var DefaultRegistry = new(GlobalConfigRegistry)

var regContextKey = struct{ S string }{"globalRegistry"}
