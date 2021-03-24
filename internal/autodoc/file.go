package autodoc

import "github.com/ppacher/system-conf/conf"

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
	// to exist in this file type.
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
	if optionRegistry, ok := f.Sections[sectionName]; ok {
		return optionRegistry, true
	}
	if f.LazySectionsFunc != nil {
		if optionRegistry, ok := f.LazySectionsFunc()[sectionName]; ok {
			return optionRegistry, true
		}
	}
	return nil, false
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
