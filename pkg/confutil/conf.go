package confutil

import (
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
)

// AbsConfig ensures that path is absolute and if not, prepends the
// configuration directory. AbsConfig is a no-op if path is an empty
// string.
func AbsConfig(path string) string {
	if path == "" {
		return ""
	}
	if !filepath.IsAbs(path) {
		return filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	return path
}

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

// All wraps OptionRegistry.All and marks al options as "optional".
func (optreg *OptionalOptionRegistry) All() []conf.OptionSpec {
	all := optreg.OptionRegistry.All()
	r := make([]conf.OptionSpec, len(all))
	for idx, opt := range all {
		opt.Required = false
		r[idx] = opt
	}

	return r
}

// MakeOptional makes all options form reg optional by resetting the
// Required field to false.
func MakeOptional(reg conf.OptionRegistry) conf.OptionRegistry {
	return &OptionalOptionRegistry{
		OptionRegistry: reg,
	}
}

func MapToOptions(m map[string]interface{}) ([]conf.Option, error) {
	var options []conf.Option
	for name, val := range m {
		opts, err := conf.EncodeToOptions(name, val)
		if err != nil {
			return nil, httperr.BadRequest(echo.Map{
				"error": "invalid values for option",
				"name":  name,
			}).SetInternal(err)
		}

		options = append(options, opts...)
	}

	return options, nil
}
