package openinghours

import "github.com/tierklinik-dobersberg/cis/runtime"

var (
	configBuilder = runtime.NewConfigSchemaBuilder(addOpeningHours)

	// AddToSchema adds the opening hour definition/config spec to the
	// provided cofig schema.
	AddToSchema = configBuilder.AddToSchema
)

func init() {
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
