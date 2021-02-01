package identitydb

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
)

// autologinRegistry wraps a httpcond.Registry and adds additional custom
// option definitions when used as a conf.SectionRegistry.
type autologinRegistry struct {
	*httpcond.Registry
	customSpecs conf.SectionSpec
}

func newAutologinRegistry(cond *httpcond.Registry, custom conf.SectionSpec) *autologinRegistry {
	return &autologinRegistry{
		Registry:    cond,
		customSpecs: custom,
	}
}

func (alr *autologinRegistry) All() []conf.OptionSpec {
	conds := alr.Registry.All()
	return append(alr.customSpecs, conds...)
}

func (alr *autologinRegistry) GetOption(name string) (conf.OptionSpec, bool) {
	if opt, ok := alr.customSpecs.GetOption(name); ok {
		return opt, true
	}

	return alr.Registry.GetOption(name)
}

func (alr *autologinRegistry) HasOption(name string) bool {
	_, ok := alr.GetOption(name)
	return ok
}
