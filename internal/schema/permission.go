package schema

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
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

// BuildPermission builds a permission Object from the given section.
func BuildPermission(sec conf.Section) (*Permission, error) {
	p := new(Permission)

	var err error
	p.Description, err = getOptionalString(sec, "Description")
	if err != nil {
		return nil, fmt.Errorf("Permission.Description: %w", err)
	}

	p.Effect, err = sec.GetString("Effect")
	if err != nil {
		return nil, fmt.Errorf("Permission.Effect: %w", err)
	}

	p.Resources = sec.GetStringSlice("Resource")
	p.Domains = sec.GetStringSlice("Domain")

	return p, nil
}
