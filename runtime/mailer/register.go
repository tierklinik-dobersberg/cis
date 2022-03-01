package mailer

import (
	"context"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(addToSchema)
	AddToSchema   = ConfigBuilder.AddToSchema
)

func addToSchema(schema *runtime.ConfigSchema) error {
	return schema.Register(runtime.Schema{
		Name:        "Mailer",
		Description: "Configure a SMTP server to allow sending emails.",
		DisplayName: "E-Mail Einstellungen",
		Spec:        AccountSpec,
		Multi:       false,
		Category:    "Integration",
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`,
		Tests: []runtime.ConfigTest{
			{
				ID:   "test-mail",
				Name: "Send test mail",
				Spec: MessageSpec,
				TestFunc: func(ctx context.Context, config, testSpec []conf.Option) (*runtime.TestResult, error) {
					var (
						acc Account
						msg Message
					)

					if err := conf.DecodeSections(
						conf.Sections{
							{
								Name:    "Account",
								Options: config,
							},
						},
						AccountSpec,
						&acc,
					); err != nil {
						return runtime.NewTestError(err), nil
					}
					if err := conf.DecodeSections(
						conf.Sections{
							{Name: "Message",
								Options: testSpec,
							},
						},
						MessageSpec,
						&msg,
					); err != nil {
						return runtime.NewTestError(err), nil
					}

					mailer, err := New(acc)
					if err != nil {
						return runtime.NewTestError(err), nil
					}

					if err := mailer.Send(ctx, msg, nil); err != nil {
						return runtime.NewTestError(err), nil
					}

					return nil, nil
				},
			},
		},
	})
}

func init() {
	// create a global [Mailer] configuration section
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
	// Register the mailer as a trigger type at the default
	// registry as [SendMail]
	runtime.Must(
		AddTriggerType("SendMail", trigger.DefaultRegistry),
	)
}
