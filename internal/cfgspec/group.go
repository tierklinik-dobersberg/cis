package cfgspec

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// Role defines the structure of a user role.
type Role struct {
	v1alpha.Role `bson:",inline"`
}

// RoleSpec defines the properties of a role.
var RoleSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Description: "Name of the role.",
		Default:     "%N",
		Type:        conf.StringType,
	},
	{
		Name:        "Description",
		Description: "An optional description for the role.",
		Type:        conf.StringType,
	},
}
