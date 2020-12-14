package schema

import (
	"github.com/ppacher/system-conf/conf"
)

// UserSchemaExtension describes the opions available when defining
// new user properties.
var UserSchemaExtension = []conf.OptionSpec{
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
}
