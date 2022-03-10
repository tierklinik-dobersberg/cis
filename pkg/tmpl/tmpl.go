// Package tmpl provides template rendering for triggers.
package tmpl

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"strings"
	"text/template"

	"github.com/Masterminds/sprig/v3"
)

/*
func createDataFuncs(ctx context.Context) map[string]interface{} {
	f := make(map[string]interface{})

	ns := funcs.DataNS()
	ns.ctx = ctx

	f["data"] = funcs.DataNS

	f["json"] = ns.JSON
	f["jsonArray"] = ns.JSONArray
	f["yaml"] = ns.YAML
	f["yamlArray"] = ns.YAMLArray
	f["toml"] = ns.TOML
	f["csv"] = ns.CSV
	f["csvByRow"] = ns.CSVByRow
	f["csvByColumn"] = ns.CSVByColumn
	f["toJSON"] = ns.ToJSON
	f["toJSONPretty"] = ns.ToJSONPretty
	f["toYAML"] = ns.ToYAML
	f["toTOML"] = ns.ToTOML
	f["toCSV"] = ns.ToCSV

	return f
}
*/

func tmplFuncMap(ctx context.Context) template.FuncMap {
	f := template.FuncMap{}

	addToMap(f, sprig.GenericFuncMap())

	//addToMap(f, createDataFuncs(ctx))
	//addToMap(f, funcs.CreateBase64Funcs(ctx))
	//addToMap(f, funcs.CreateReFuncs(ctx))
	//addToMap(f, funcs.CreateStringFuncs(ctx))
	//addToMap(f, funcs.CreateConvFuncs(ctx))
	//addToMap(f, funcs.CreateTimeFuncs(ctx))
	//addToMap(f, funcs.CreateMathFuncs(ctx))
	//addToMap(f, funcs.CreateCryptoFuncs(ctx))
	//addToMap(f, funcs.CreateFilePathFuncs(ctx))
	//addToMap(f, funcs.CreatePathFuncs(ctx))
	//addToMap(f, funcs.CreateTestFuncs(ctx))
	//addToMap(f, funcs.CreateCollFuncs(ctx))
	//addToMap(f, funcs.CreateUUIDFuncs(ctx))
	//addToMap(f, funcs.CreateRandomFuncs(ctx))

	return f
}

func RenderTo(ctx context.Context, tmplBody string, renderContext interface{}, w io.Writer) error {
	t, err := template.New("main").Parse(tmplBody)
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}

	t.Funcs(tmplFuncMap(ctx))
	if err := t.Execute(w, renderContext); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}
	return nil
}

func Render(ctx context.Context, tmplBody string, renderContext interface{}) (string, error) {
	result := new(strings.Builder)

	if err := RenderTo(ctx, tmplBody, renderContext, result); err != nil {
		return "", err
	}

	return result.String(), nil
}

// RenderFile is like Render but reads the template definition from path.
func RenderFile(ctx context.Context, path string, renderContext interface{}) (string, error) {
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read template file: %w", err)
	}

	return Render(ctx, string(content), renderContext)
}

// addToMap - add src's entries to dst
func addToMap(dst, src map[string]interface{}) {
	for k, v := range src {
		dst[k] = v
	}
}
