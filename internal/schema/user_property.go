package schema

import (
	"fmt"

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

// BuildUserPropertySpec builds a user property spec from
// the section sec.
func BuildUserPropertySpec(sec conf.Section) (c conf.OptionSpec, err error) {
	c.Name, err = sec.GetString("Name")
	if err != nil {
		return c, fmt.Errorf("Name: %w", err)
	}

	c.Description, err = sec.GetString("Description")
	if err != nil && !conf.IsNotSet(err) {
		return c, fmt.Errorf("Description: %w", err)
	}

	typeStr, err := sec.GetString("Type")
	if err != nil {
		return c, fmt.Errorf("Type: %w", err)
	}

	optType := conf.TypeFromString(typeStr)
	if optType == nil {
		return c, fmt.Errorf("Type: unknown type %s", typeStr)
	}
	c.Type = *optType

	c.Required, err = sec.GetBool("Required")
	if err != nil && !conf.IsNotSet(err) {
		return c, fmt.Errorf("Required: %w", err)
	}

	c.Default, err = sec.GetString("Default")
	if err != nil && !conf.IsNotSet(err) {
		return c, fmt.Errorf("Default: %w", err)
	}

	return c, nil
}
