package layouts

import (
	"bytes"
	"fmt"
	"html/template"
	"io/ioutil"
	"path"
	"reflect"
	"strconv"
	"strings"

	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var markdownRenderer goldmark.Markdown

func init() {
	markdownRenderer = goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
		),
	)
}

// Vars holds layout variables.
type Vars map[string]interface{}

type templateContext struct {
	RenderContext
	Vars map[string]interface{}
}

var templateFuncs = template.FuncMap{
	"html": func(s string) template.HTML { return template.HTML(s) },
}

type RenderContext struct {
	Preview  bool
	Embedded bool
}

// Render renders the layout l.
func Render(l *Layout, vars Vars, renderCtx *RenderContext) ([]byte, error) {
	if renderCtx == nil {
		renderCtx = new(RenderContext)
	}

	content, err := getLayoutContent(l)
	if err != nil {
		return nil, err
	}
	parsedTemplate, err := template.
		New(l.Name).
		Funcs(templateFuncs).
		Parse(string(content))
	if err != nil {
		return nil, err
	}
	data, err := prepareVars(l, vars)
	if err != nil {
		return nil, err
	}
	buf := new(bytes.Buffer)
	if err := parsedTemplate.Execute(buf, templateContext{
		RenderContext: *renderCtx,
		Vars:          data,
	}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func getLayoutContent(l *Layout) ([]byte, error) {
	if l.File != "" {
		return ioutil.ReadFile(l.FilePath(l.File))
	}
	return []byte(l.Content), nil
}

func prepareVars(l *Layout, vars Vars) (map[string]interface{}, error) {
	errors := &multierr.Error{}

	data := make(map[string]interface{}, len(vars))
	for vn, vv := range vars {
		def := l.Var(vn)
		if def == nil {
			errors.Addf("unknown variable with name %s", vn)
			continue
		}
		value, err := validateAndNormalize(vv, def)
		if err != nil {
			errors.Addf("variable %s: %w", vn, err)
			continue
		}

		data[vn] = value
	}

	for _, def := range l.Variables {
		_, isSet := data[def.Name]
		if !isSet && def.Required {
			errors.Addf("missing required variable %s", def.Name)
			continue
		}
	}
	return data, errors.ToError()
}

func isAllowedValue(val string, def *Variable) bool {
	if len(def.Choices) == 0 {
		return true
	}
	for _, needle := range def.Choices {
		if needle == val {
			return true
		}
	}
	return false
}

func validateAndNormalize(value interface{}, def *Variable) (interface{}, error) {
	switch def.Type {
	case TypeBool:
		return normalizeBool(value)
	case TypeString:
		val, err := normalizeString(value)
		if err != nil {
			return nil, err
		}

		if !isAllowedValue(val, def) {
			return nil, fmt.Errorf("value %q is not allowed", val)
		}

		val, err = formatString(val, def.Format)
		if err != nil {
			return nil, err
		}
		return val, nil
		// finally, make sure we remove all dangerous HTML
		//return bluemonday.UGCPolicy().Sanitize(val), nil
	case TypeStringList:
		ss, err := normalizeStringList(value)
		if err != nil {
			return nil, err
		}
		for idx := range ss {
			ss[idx], err = formatString(ss[idx], def.Format)
			if err != nil {
				return nil, err
			}
		}
		return ss, nil
	case TypeImage, TypeVideo:
		return normalizeFile(value)
	case TypeNumber:
		return normalizeNumber(value)

	default:
		return nil, fmt.Errorf("unknown variable type %q", def.Type)
	}
}

func formatString(val string, format string) (string, error) {
	switch format {
	case "", FormatPlain:
		return val, nil

	case FormatHTML:
		return val, nil

	case FormatMarkdown:
		return renderMarkdown(val)
	default:
		return val, fmt.Errorf("unsupported format %q", format)
	}
}

func renderMarkdown(val string) (string, error) {
	buf := new(bytes.Buffer)
	if err := markdownRenderer.Convert([]byte(val), buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func normalizeNumber(value interface{}) (float64, error) {
	ft := reflect.TypeOf(float64(0))
	dv := reflect.ValueOf(value)
	if dv.Type().ConvertibleTo(ft) {
		dv = dv.Convert(ft)
	}

	if !dv.Type().AssignableTo(ft) {
		return 0, fmt.Errorf("unsupported number value: %T", value)
	}
	fn := reflect.New(ft).Elem()
	fn.Set(dv)

	return fn.Interface().(float64), nil
}

func normalizeString(value interface{}) (string, error) {
	if s, ok := value.(string); ok {
		return s, nil
	}
	return "", fmt.Errorf("unsupported string value: %T", value)
}

func normalizeStringList(value interface{}) ([]string, error) {
	if sv, ok := value.([]string); ok {
		return sv, nil
	}
	var res []string
	if is, ok := value.([]interface{}); ok {
		for _, val := range is {
			// TODO(ppacher): should we error out if !ok
			if s, ok := val.(string); ok {
				res = append(res, s)
			}
		}
		return res, nil
	}
	if pa, ok := value.(primitive.A); ok {
		for _, val := range pa {
			// TODO(ppacher): should we error out if !ok
			if s, ok := val.(string); ok {
				res = append(res, s)
			}
		}
		return res, nil
	}
	return nil, fmt.Errorf("unsupported stirng slice type: %T", value)
}

func normalizeFile(value interface{}) (string, error) {
	if s, ok := value.(string); ok {
		return path.Join("uploaded/", s), nil
	}
	return "", fmt.Errorf("unsupported string value: %T", value)
}

func normalizeBool(value interface{}) (bool, error) {
	switch v := value.(type) {
	case bool:
		return v, nil
	case string:
		if strings.ToLower(v) == "yes" {
			return true, nil
		}
		if strings.ToLower(v) == "no" {
			return false, nil
		}
		return strconv.ParseBool(v)
	}
	return false, fmt.Errorf("unsupported boolean value: %T", value)
}
