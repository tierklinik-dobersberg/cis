package mailer

import (
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/service/runtime"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(addToSchema)
	AddToSchema   = ConfigBuilder.AddToScheme
)

func addToSchema(schema *runtime.ConfigSchema) error {
	schema.RegisterSection(
		"Mailer",
		"Configure a SMTP server to allow sending emails.",
		AccountSpec,
	)
	return nil
}

func init() {
	// create a global [Mailer] configuration section
	AddToSchema(runtime.GlobalSchema)
	// Register the mailer as a trigger type at the default
	// registry as [SendMail]
	AddTriggerType("SendMail", trigger.DefaultRegistry)
}
