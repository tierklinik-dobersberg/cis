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
		DisplayName: "SMS Einstellungen",
		Spec:        AccountSpec,
		Multi:       false,
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />`,
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
