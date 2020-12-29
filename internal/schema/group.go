package schema

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// Group defines the structure of a user group
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
