package markdown

import (
	"bytes"
	"fmt"

	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

func init() {
	autodoc.MustRegisterRenderer("markdown", MarkdownRenderer{})
}

// MarkdownRenderer renders (autodoc.File)s as markdown.
type MarkdownRenderer struct{}

func (MarkdownRenderer) RenderFile(f autodoc.File) (string, error) {
	var buf = new(bytes.Buffer)

	if f.Multiple {
		fmt.Fprintf(buf, "# [unit]%s\n", f.Name)
	} else {
		fmt.Fprintf(buf, "# %s\n", f.Name)
	}
	fmt.Fprintln(buf)

	if f.Description != "" {
		fmt.Fprintf(buf, "%s  \n\n", f.Description)
	}

	if f.DropinsAllowed {
		fmt.Fprintf(buf, "Drop-In files for this configuration unit are supported.\n\n")
	}

	if len(f.LookupPaths) > 0 {
		fmt.Fprintf(buf, "## Lookup Paths\n\n")
		fmt.Fprintf(buf, "\nThe following paths are searched in order to find this configuration unit:\n")
		for _, path := range f.LookupPaths {
			fmt.Fprintf(buf, " - %s\n", path)
		}
	}

	fmt.Fprintf(buf, "## Sections\n\n")

	for name, options := range f.GetSections() {
		fmt.Fprintf(buf, "### [%s]\n\n", name)

		for _, opt := range options {
			fmt.Fprintf(buf, "`%s=` (%s)   \n%s\n\n", opt.Name, opt.Type, opt.Description)
		}
		fmt.Fprintln(buf)
	}

	fmt.Fprintln(buf)

	if f.Example != "" {
		example := autodoc.Unindent(f.Example)
		fmt.Fprintf(buf, "## Example\n\n```ini\n%s\n```\n\n%s\n\n", example, f.ExampleDescription)
	}

	if f.Template != "" || f.LazyTemplateFunc != nil {
		template := f.Template
		if f.LazyTemplateFunc != nil {
			template = f.LazyTemplateFunc()
		}

		template = autodoc.Unindent(template)

		fmt.Fprintf(buf, "## Template\n\n```ini\n%s\n\n```", template)
	}

	return buf.String(), nil
}
