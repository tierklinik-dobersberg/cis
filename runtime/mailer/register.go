package mailer

import (
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
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`,
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
