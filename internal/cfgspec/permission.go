package cfgspec

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// Permission describes a permission of a user or role to perform
// a given action.
type Permission struct {
	v1alpha.Permission `bson:",inline"`
}

// PermissionSpec describes the configuration stanzas for the Permission struct.
var PermissionSpec = conf.SectionSpec{
	{
		Name:        "Description",
		Description: "An optional description of the permission set",
		Type:        conf.StringType,
	},
	{
		Name:        "Resource",
		Type:        conf.StringSliceType,
		Default:     "(.*)",
		Description: "One or more resource paths that are either allowed or denied.",
	},
	{
		Name:        "Effect",
		Type:        conf.StringType,
		Description: "Either \"Allow\" or \"Deny\".",
		Required:    true,
	},
	{
		Name:        "Action",
		Type:        conf.StringSliceType,
		Description: "One or more actions",
	},
}
