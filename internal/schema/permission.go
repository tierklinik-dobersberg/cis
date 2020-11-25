package schema

import "github.com/ppacher/system-conf/conf"

var PermissionSpec = []conf.OptionSpec{
	{
		Name:        "Description",
		Description: "An optional description of the permission set",
		Type:        conf.StringType,
	},
	{
		Name:        "Resources",
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
	{
		Name:        "Subject",
		Type:        conf.StringSliceType,
		Required:    true,
		Description: "One or more subjects or expressions (usernames, groupnames, ...)",
	},
}
