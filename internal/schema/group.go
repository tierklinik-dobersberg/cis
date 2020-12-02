package schema

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type Group struct {
	v1alpha.Group
}

// GroupSpec defines the properties of a group.
var GroupSpec = []conf.OptionSpec{
	{
		Name:        "Name",
		Description: "Name of the group.",
		Default:     "%N",
		Type:        conf.StringType,
	},
	{
		Name:        "Description",
		Description: "An optional description for the group.",
		Type:        conf.StringType,
	},
}

// BuildGroup builds a group model from the specified section.
func BuildGroup(sec conf.Section) (Group, error) {
	var g Group
	var err error

	g.Name, err = sec.GetString("Name")
	if err != nil {
		return g, fmt.Errorf("group.Name: %w", err)
	}

	g.Description, err = getOptionalString(sec, "Description")
	if err != nil {
		return g, fmt.Errorf("group.Description: %w", err)
	}

	return g, nil
}
