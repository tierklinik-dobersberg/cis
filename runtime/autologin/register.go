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
	return schema.Register(runtime.Registration{
		Name:        "Autologin",
		Description: "Configure token access and automatic role grants",
		Spec:        Spec(httpcond.DefaultRegistry),
		Multi:       true,
	})
}

func init() {
	// Declare a global [Autologin] section
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
