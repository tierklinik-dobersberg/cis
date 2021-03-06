package json

import (
	"bytes"
	"encoding/json"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/autodoc"
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
		Sections: f.GetSections(),
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
