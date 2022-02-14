package autologin

import (
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(addToSchema)
	AddToSchema   = ConfigBuilder.AddToSchema
)

func addToSchema(schema *runtime.ConfigSchema) error {
	return schema.RegisterSection(
		"Autologin",
		"Configure token access and automatic role grants",
		Spec(httpcond.DefaultRegistry),
	)
}

func init() {
	// Declare a global [Autologin] section
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
