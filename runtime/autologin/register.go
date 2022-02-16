package autologin

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(addToSchema)
	AddToSchema   = ConfigBuilder.AddToSchema
)

func addToSchema(schema *runtime.ConfigSchema) error {
	return schema.Register(runtime.Schema{
		Name:        "Autologin",
		Description: "Configure token access and automatic role grants",
		Spec:        Spec(httpcond.DefaultRegistry),
		Multi:       true,
		Annotations: new(conf.Annotation).With(
			runtime.OverviewFields("Name", "User", "Roles"),
		),
	})
}

func init() {
	// Declare a global [Autologin] section
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
