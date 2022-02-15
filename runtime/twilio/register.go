package twilio

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
		Name:        "Twilio",
		Description: "Configure a twilio account to use for programmable messaging.",
		Category:    "",
		Spec:        AccountSpec,
		Multi:       false,
	})
}

func init() {
	// Declare a global [Twilio] section for the account
	// configuration.
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
	// Add a [SendSMS] trigger type
	runtime.Must(
		AddTriggerType("SendSMS", trigger.DefaultRegistry),
	)
}
