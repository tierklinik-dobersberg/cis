package layouts

import (
	"path/filepath"

	"github.com/hashicorp/hcl/v2/hclsimple"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
)

// Variable defines an input variable for a template layout.
type Variable struct {
	Name        string `hcl:"name,label"`
	Type        string `hcl:"type"`
	Description string `hcl:"description"`
}

// Layout defines a new slide layout.
type Layout struct {
	Name         string     `hcl:"name,label"`
	File         string     `hcl:"file"`
	Content      string     `hcl:"content"`
	StaticAssets []string   `hcl:"assets"`
	Variables    []Variable `hcl:"variable,block"`

	// parentDir holds the path to the parent directory
	// that contained the layout file. This directory should
	// be used as the root for all files referenced in the
	// layout definition (like static assets).
	parentDir string
}

// ParentDir returns the directory that contains the layout definition.
// This directory must be used as the root for all static file assets
// referenced by the layout.
func (l *Layout) ParentDir() string {
	return l.parentDir
}

// Validate layout and return any errors encountered
func Validate(layout Layout) error {
	errors := &multierr.Error{}

	if layout.Name == "" {
		errors.Addf("Missing layout name.")
	}

	if layout.File == "" && layout.Content == "" {
		errors.Addf("No layout file or content set.")
	}

	if layout.parentDir == "" {
		errors.Addf("No layout directory (internal).")
	}

	return errors.ToError()
}

// ParseFile parses a layout from fpath. All files referenced in
// the layout are relative to the parent directory of fpath.
func ParseFile(fpath string) (*Layout, error) {
	l := &Layout{
		parentDir: filepath.Dir(fpath),
	}
	if err := hclsimple.DecodeFile(fpath, nil, l); err != nil {
		return nil, err
	}
	if err := Validate(*l); err != nil {
		return nil, err
	}
	return l, nil
}
