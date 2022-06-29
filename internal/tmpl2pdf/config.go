package tmpl2pdf

import (
	"context"
	"io"
	"os"
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type Config struct {
	Server        string
	AllowInsecure bool
}

var Spec = conf.SectionSpec{
	{
		Name:        "Server",
		Description: "The address of the kwkhtmltopdf server.",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "AllowInsecure",
		Description: "Whether or not insecure TLS server certificates are accepted",
		Type:        conf.BoolType,
	},
}

func (creator *Creator) AddToSchema(schema *runtime.ConfigSchema) error {
	fromURLSpec := conf.SectionSpec{
		{
			Name:        "URL",
			Type:        conf.StringType,
			Description: "URL that should be printed as a PDF",
			Required:    true,
		},
	}

	fromTmplSpec := conf.SectionSpec{
		{
			Name:        "Template",
			Type:        conf.StringType,
			Description: "The template to render",
			Required:    true,
			Annotations: new(conf.Annotation).With(
				runtime.StringFormat("text/plain"),
			),
		},
	}

	err := schema.Register(runtime.Schema{
		Name:        "tmpl2pdf",
		DisplayName: "PDF Generation",
		Description: "Settings for PDF generation",
		SVGData:     `<path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />`,
		Spec:        Spec,
		Tests: []runtime.ConfigTest{
			{
				ID:   "generate-url-pdf",
				Name: "PDF aus URL erstellen",
				Spec: fromURLSpec,
				TestFunc: func(ctx context.Context, config, testConfig []conf.Option) (*runtime.TestResult, error) {
					var testCase struct {
						URL string
					}

					name, err := utils.Nonce(32)
					if err != nil {
						return nil, err
					}

					if err := conf.DecodeSections([]conf.Section{
						{
							Name:    "Test",
							Options: testConfig,
						},
					}, fromURLSpec, &testCase); err != nil {
						return runtime.NewTestError(err), nil
					}

					var cfg Config

					if err := conf.DecodeSections([]conf.Section{
						{
							Name:    "Config",
							Options: config,
						},
					}, Spec, &cfg); err != nil {
						return runtime.NewTestError(err), nil
					}

					targetFileDir := filepath.Join(
						svcenv.Env().StateDirectory,
						"pdf-test",
					)
					if err := os.MkdirAll(targetFileDir, 0700); err != nil {
						return runtime.NewTestError(err), nil
					}

					targetFilePath := filepath.Join(
						targetFileDir,
						name+".pdf",
					)

					targetFile, err := os.Create(targetFilePath)
					if err != nil {
						return runtime.NewTestError(err), nil
					}
					defer targetFile.Close()

					reader, err := ConvertURLToPDF(ctx, creator.getClient(), cfg.Server, testCase.URL)
					if err != nil {
						return runtime.NewTestError(err), nil
					}

					if _, err := io.Copy(targetFile, reader); err != nil {
						return runtime.NewTestError(err), nil
					}

					return &runtime.TestResult{}, nil
				},
			},
			{
				ID:   "generate-tmpl-pdf",
				Name: "Generate PDF from template",
				Spec: fromTmplSpec,
				TestFunc: func(ctx context.Context, config, testSpec []conf.Option) (*runtime.TestResult, error) {
					var testCfg struct {
						Template string
					}

					if err := conf.DecodeSections(
						conf.Sections{
							{
								Name:    "TestSpec",
								Options: testSpec,
							},
						},
						fromTmplSpec,
						&testCfg,
					); err != nil {
						return runtime.NewTestError(err), nil
					}

					res, err := creator.Render(ctx, RenderRequest{
						Template: testCfg.Template,
					})
					if err != nil {
						return runtime.NewTestError(err), nil
					}

					return &runtime.TestResult{
						Message: res,
					}, nil
				},
			},
		},
	})
	if err != nil {
		return err
	}

	schema.AddNotifier(creator, "tmpl2pdf")

	return nil
}
