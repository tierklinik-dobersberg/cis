package json

import (
	"bytes"
	"encoding/json"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

func init() {
	autodoc.MustRegisterRenderer("json", new(JSONRenderer))
}

type File struct {
	autodoc.File

	Sections map[string][]conf.OptionSpec
	Template string
}

// JSONRenderer renders (autodoc.File)s as JSON.
type JSONRenderer struct{}

func (js *JSONRenderer) RenderFile(f autodoc.File) (string, error) {
	file := File{
		File:     f,
		Sections: make(map[string][]conf.OptionSpec),
	}

	// convert conf.OptionRegistry to []conf.OptionSpec
	for key, value := range f.Sections {
		file.Sections[key] = value.All()
	}

	if f.LazySectionsFunc != nil {
		for key, value := range f.LazySectionsFunc() {
			file.Sections[key] = append(file.Sections[key], value.All()...)
		}
	}

	if f.LazyTemplateFunc != nil {
		file.Template = f.LazyTemplateFunc()
	}

	buf := new(bytes.Buffer)
	encoder := json.NewEncoder(buf)

	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "    ")

	if err := encoder.Encode(file); err != nil {
		return "", err
	}

	return buf.String(), nil
}
