package utils

import (
	"path/filepath"
	"strings"

	"github.com/ppacher/system-conf/conf"
)

// LoadFiles loads all files in dir that have the extension ext and
// parses them using spec.
func LoadFiles(dir, ext string, spec conf.SectionRegistry) ([]*conf.File, error) {
	names := make(map[string]struct{})
	files := make([]*conf.File, 0)

	dirFiles, err := conf.ReadDir(dir, ext, spec)
	if err != nil {
		return nil, err
	}

	for _, file := range dirFiles {
		name := filepath.Base(file.Path)
		if _, ok := names[name]; ok {
			continue
		}

		dropins, err := conf.LoadDropIns(filepath.Base(file.Path), []string{dir})
		if err != nil {
			return nil, err
		}

		if err := conf.ApplyDropIns(file, dropins, spec); err != nil {
			return nil, err
		}

		files = append(files, file)
		names[name] = struct{}{}
	}

	return files, nil
}

// MultiSectionRegistry is a helper type to create a conf.SectionRegistry from
// multiple registries.
type MultiSectionRegistry []conf.SectionRegistry

// OptionsForSection implements conf.SectionRegistry.
func (msr MultiSectionRegistry) OptionsForSection(sec string) (conf.OptionRegistry, bool) {
	for _, sr := range msr {
		reg, ok := sr.OptionsForSection(sec)
		if ok {
			return reg, true
		}
	}
	return nil, false
}

// MultiOptionRegistry is a helper type to create a conf.OptionRegistry from
// multiple registries.
type MultiOptionRegistry []conf.OptionRegistry

// All merges all option specs form all option registries.
// Duplicate option specs are removed and the first option spec
// has priority.
func (mor MultiOptionRegistry) All() []conf.OptionSpec {
	var result []conf.OptionSpec
	seen := make(map[string]bool)
	for _, or := range mor {
		for _, opt := range or.All() {
			ln := strings.ToLower(opt.Name)
			if seen[ln] {
				continue
			}
			seen[ln] = true
			result = append(result, opt)
		}
	}
	return result
}

// FIXME(ppacher): finally get rid of this method from conf.OptionRegistry.
// It's just not useful to re-implement it the same way every time.
func (mor MultiOptionRegistry) HasOption(opt string) bool {
	_, ok := mor.GetOption(opt)
	return ok
}

// GetOption returns the option spec for opt. The first option spec that matches
// wins and has priority.
func (mor MultiOptionRegistry) GetOption(opt string) (conf.OptionSpec, bool) {
	for _, or := range mor {
		if opt, ok := or.GetOption(opt); ok {
			return opt, true
		}
	}
	return conf.OptionSpec{}, false
}

type OptionalOptionRegistry struct {
	conf.OptionRegistry
}

// GetOption wraps OptionRegistry.GetOption and marks all options as "optional".
func (optreg *OptionalOptionRegistry) GetOption(opt string) (conf.OptionSpec, bool) {
	spec, ok := optreg.OptionRegistry.GetOption(opt)
	if !ok {
		return conf.OptionSpec{}, false
	}
	spec.Required = false
	return spec, true
}
