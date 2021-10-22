package layouts

import (
	"path/filepath"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsimple"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/zclconf/go-cty/cty"
)

// Variable defines an input variable for a template layout.
type Variable struct {
	Name        string   `hcl:"name,label" json:"name"`
	Type        string   `hcl:"type" json:"type"`
	Description string   `hcl:"description,optional" json:"description,omitempty"`
	Required    bool     `hcl:"required,optional" json:"required,omitempty"`
	Format      string   `hcl:"format,optional" json:"format,omitempty"`
	Multiline   bool     `hcl:"multiline,optional" json:"multiline,omitempty"`
	DisplayName string   `hcl:"displayName,optional" json:"displayName,omitempty"`
	Choices     []string `hcl:"choices,optional" json:"choices,omitempty"`
	Multi       bool     `hcl:"multi,optional" json:"multi,omitempty"`
}

// Layout defines a new slide layout.
type Layout struct {
	Name        string     `hcl:"name,label" json:"name"`
	DisplayName string     `hcl:"displayName" json:"displayName"`
	File        string     `hcl:"file,optional" json:"file,omitempty"`
	Content     string     `hcl:"content,optional" json:"content,omitempty"`
	Description string     `hcl:"description,optional" json:"description,omitempty"`
	Variables   []Variable `hcl:"variable,block" json:"variables"`
	PreviewIcon string     `hcl:"previewIcon" json:"previewIcon"`

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

// FilePath returns the absolute file path to fpath.
func (l *Layout) FilePath(fpath string) string {
	if filepath.IsAbs(fpath) {
		return fpath
	}
	return filepath.Join(l.parentDir, fpath)
}

// Var returns the definition for the variable name.
func (l *Layout) Var(name string) *Variable {
	for _, v := range l.Variables {
		if v.Name == name {
			return &v
		}
	}
	return nil
}

// Validate layout and return any errors encountered.
func Validate(layout *Layout) error {
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

	for idx, def := range layout.Variables {
		if def.Name == "" {
			errors.Addf("variable name is required")
		}
		if !IsKnownType(def.Type) {
			errors.Addf("%s: unknown variable type %s", def.Name, def.Type)
		}
		if isStringLike(def) {
			if def.Format == "" {
				layout.Variables[idx].Format = FormatPlain
				def.Format = FormatPlain
			}
			if !IsKnownFormat(def.Format) {
				errors.Addf("%s: unknown format %s", def.Name, def.Format)
			}
		} else {
			if def.Format != "" {
				errors.Addf("%s: format is only allowed for string types", def.Name)
			}
			if def.Multiline {
				errors.Addf("%s: multiline is only allowed for string types", def.Name)
			}
			if len(def.Choices) > 0 {
				errors.Addf("%s: choices are only allowed for string types", def.Name)
			}
		}
	}

	return errors.ToError()
}

func isStringLike(def Variable) bool {
	return def.Type == TypeString
}

// ParseFile parses a layout from fpath. All files referenced in
// the layout are relative to the parent directory of fpath.
func ParseFile(fpath string) (*Layout, error) {
	file := struct {
		Layout *Layout `hcl:"layout,block"`
	}{
		Layout: &Layout{
			parentDir: filepath.Dir(fpath),
		},
	}

	evalCtx, err := getEvalContext(fpath)
	if err != nil {
		return nil, err
	}
	if err := hclsimple.DecodeFile(fpath, evalCtx, &file); err != nil {
		return nil, err
	}
	if err := Validate(file.Layout); err != nil {
		return nil, err
	}
	return file.Layout, nil
}

func getEvalContext(fpath string) (*hcl.EvalContext, error) {
	return &hcl.EvalContext{
		Variables: map[string]cty.Value{
			"string":   cty.StringVal(TypeString),
			"color":    cty.StringVal(TypeColor),
			"number":   cty.StringVal(TypeNumber),
			"bool":     cty.StringVal(TypeBool),
			"image":    cty.StringVal(TypeImage),
			"video":    cty.StringVal(TypeVideo),
			"markdown": cty.StringVal(FormatMarkdown),
			"html":     cty.StringVal(FormatHTML),
			"plain":    cty.StringVal(FormatPlain),
			"root":     cty.StringVal(filepath.Dir(fpath)),
		},
	}, nil
}
