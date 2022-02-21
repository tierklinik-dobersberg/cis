package cfgspec

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

// UserPropertyDefinition is the definition of a user property.
type UserPropertyDefinition struct {
	conf.OptionSpec
	Visibility  string `json:"visibility"`
	DisplayName string `json:"displayName,omitempty"`
}

// UserSchemaExtension describes the opions available when defining
// new user properties.
var UserSchemaExtension = conf.SectionSpec{
	{
		Name:        "Name",
		Description: "The name of the property",
		Required:    true,
		Type:        conf.StringType,
	},
	{
		Name:        "Description",
		Description: "An optional description of the property",
		Type:        conf.StringType,
	},
	{
		Name:        "Type",
		Description: "The string representation of a supported type",
		Required:    true,
		Type:        conf.StringType,
	},
	{
		Name:        "Required",
		Description: "Wether or not this property is required",
		Type:        conf.BoolType,
	},
	{
		Name:        "Default",
		Description: "An optional default value (string form)",
		Type:        conf.StringType,
	},
	{
		Name:        "Visibility",
		Description: "Property visibility. One of 'public' (=visible for all), 'private' (=visible only for the user), 'internal' (=not exposed)",
		Type:        conf.StringType,
		Default:     "internal",
		Annotations: new(conf.Annotation).With(
			runtime.OneOf(
				runtime.PossibleValue{
					Display: "Internal",
					Value:   "internal",
				},
				runtime.PossibleValue{
					Display: "User Only",
					Value:   "private",
				},
				runtime.PossibleValue{
					Display: "Public",
					Value:   "public",
				},
			),
		),
	},
	{
		Name:        "DisplayName",
		Description: "Value to display in user interfaces",
		Type:        conf.StringType,
	},
}

func addUserProperty(schema *runtime.ConfigSchema) error {
	return schema.Register(runtime.Schema{
		Name:        "UserProperty",
		Description: "Additional, non-standard user properties for integration with external systems",
		Spec:        UserSchemaExtension,
		DisplayName: "Benutzer Erweiterungen",
		Multi:       true,
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />`,
		Annotations: new(conf.Annotation).With(
			runtime.OverviewFields("DisplayName", "Name", "Description", "Type", "Required"),
		),
	})
}
