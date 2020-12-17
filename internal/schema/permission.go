package schema

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

type Permission struct {
	v1alpha.Permission
}

var PermissionSpec = []conf.OptionSpec{
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
		Name:        "Domain",
		Type:        conf.StringSliceType,
		Required:    true,
		Description: "One ore more domains the permission applies to",
	},
}
