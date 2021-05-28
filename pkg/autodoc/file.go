package autodoc

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/ppacher/system-conf/conf"
)

// File represents a configuration file.
type File struct {
	// Name is the name of the file. If Multiple is true
	// that Name is expected to only hold the expected file
	// extension (like .service or .trigger).
	Name string `json:"name,omitempty"`

	// Description holds a description of the configuration file.
	Description string `json:"description,omitempty"`

	// Multiple should be set to true if multiple units of the
	// described file may exist.
	Multiple bool `json:"multiple"`

	// LookupPaths might be set to the lookup paths that are
	// searched in order.
	LookupPaths []string `json:"lookupPaths,omitempty"`

	// DropinsAllowed should be set to true if drop-in files
	// are supported for this configuration unit.
	DropinsAllowed bool `json:"dropinsAllowed"`

	// Sections holds a list of all sections that are allowed
	// to exist in this file type. This must be conf.FileSpec
	// instead of conf.SectionRegistry because autodoc must be
	// able to iterate over all available sections.
	// If dynamic sections are required use LazySectionsFunc
	// that's lazily evaluated when required.
	Sections conf.FileSpec `json:"-"`

	// LazySectionsFunc can be set if some section cannot be determined
	// at init time but must be loaded by different means.
	// The result from LazySectionsFunc must always be merged with Sections.
	LazySectionsFunc func() conf.FileSpec `json:"-"`

	// Example may hold a configuration example
	Example string `json:"example,omitempty"`

	// ExampleDescription describes the configuration example
	ExampleDescription string `json:"exampleDescription,omitempty"`

	// Template holds a file template that can be used as a starting base
	Template string `json:"template,omitempty"`

	// LazyTemplateFunc can be used instead of Template if generating a
	// valid Template is not possible during build time.
	LazyTemplateFunc func() string `json:"-"`
}

// OptionsForSection implements (conf.SectionRegistry). It uses all sections defined
// in Section and will call LazySectionsFunc if set each time. Note that this behavior
// is subject to change and File might cache the result of LazySectionsFunc() for later
// use.
func (f *File) OptionsForSection(sectionName string) (conf.OptionRegistry, bool) {
	all := f.GetLowerCaseSections()
	sec, ok := all[sectionName]
	if !ok {
		return nil, false
	}
	return conf.SectionSpec(sec), true
}

// GetSections returns all sections allowed in f. It merges all sections
// defined in the Sections map with the result of LazySectionsFunc if set.
// In addition, GetSections uses (conf.OptionRegistry).All() to convert
// the section definitions to a slice of conf.OptionSpec.
func (f *File) GetSections() map[string][]conf.OptionSpec {
	s := make(map[string][]conf.OptionSpec, len(f.Sections))
	for key, value := range f.Sections {
		s[key] = value.All()
	}
	if f.LazySectionsFunc != nil {
		for key, value := range f.LazySectionsFunc() {
			s[key] = append(s[key], value.All()...)
		}
	}
	return s
}

// GetLowerCaseSections is like GetSections but converts all section
// names to lowercase.
func (f *File) GetLowerCaseSections() map[string][]conf.OptionSpec {
	s := make(map[string][]conf.OptionSpec, len(f.Sections))
	for key, value := range f.Sections {
		s[strings.ToLower(key)] = value.All()
	}
	if f.LazySectionsFunc != nil {
		for key, value := range f.LazySectionsFunc() {
			key = strings.ToLower(key)
			s[key] = append(s[key], value.All()...)
		}
	}
	return s
}

// ValidateSection validates all options in section.
func (f *File) ValidateSection(section conf.Section) error {
	allSections := f.GetLowerCaseSections()
	spec, ok := allSections[strings.ToLower(section.Name)]
	if !ok {
		return conf.ErrUnknownSection
	}
	return conf.ValidateOptions(section.Options, conf.SectionSpec(spec))
}

// ValidateFile validates all sections and options in file.
func (f *File) ValidateFile(file *conf.File) error {
	return conf.ValidateFile(file, f)
}

// LoadFile loads and validates the file at f. If dropins are allowed
// for f then all dropins in dropinSearchDir and f.LookupPaths are loaded and
// applied. Note that dropinSearchDir takes precedence over f.LookupPaths.
// See conf.DropinSearchPaths for more information on drop-in load order.
func (f *File) LoadFile(path string, dropinSearchDir []string) (*conf.File, error) {
	file, err := conf.LoadFile(path)
	if err != nil {
		return nil, err
	}

	if err := f.ValidateFile(file); err != nil {
		return nil, err
	}

	if f.DropinsAllowed {
		dropins, err := conf.LoadDropIns(
			filepath.Base(file.Path),
			append(dropinSearchDir, f.LookupPaths...),
		)
		if err != nil {
			return nil, fmt.Errorf("drop-ins: %w", err)
		}
		if err := conf.ApplyDropIns(file, dropins, f); err != nil {
			return nil, fmt.Errorf("drop-ins: %w", err)
		}
	}

	return file, nil
}
