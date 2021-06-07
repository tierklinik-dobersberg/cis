package twilio

import (
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/service/runtime"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(addtoSchema)
	AddToSchema   = ConfigBuilder.AddToScheme
)

func addtoSchema(schema *runtime.ConfigSchema) error {
	return schema.RegisterSection(
		"Twilio",
		"Configure a twilio account to use for programmable messaging.",
		AccountSpec,
	)
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
