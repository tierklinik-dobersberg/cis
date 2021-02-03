package schema

import (
	"github.com/ppacher/system-conf/conf"
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
	},
	{
		Name:        "DisplayName",
		Description: "Value to display in user interfaces",
		Type:        conf.StringType,
	},
}
