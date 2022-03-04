package autologin

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
)

var commonSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Type:        conf.StringType,
		Description: "A human readable name or description to identify the autologin grant",
		Required:    true,
		Annotations: new(conf.Annotation).With(
			runtime.Unique(),
		),
	},
	{
		Name:        "User",
		Type:        conf.StringType,
		Description: "A list of usernames that should be granted access when all conditions are met.",
		Annotations: new(conf.Annotation).With(
			runtime.OneOfUsers,
		),
	},
	{
		Name:        "Roles",
		Type:        conf.StringSliceType,
		Description: "A list of role names that should be granted to a request when all conditions are met.",
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRoles,
		),
	},
	{
		Name:        "CreateSession",
		Type:        conf.BoolType,
		Description: "Whether or not a new session should be created or if only this request should be authorized",
		Default:     "no",
	},
}

// Spec returns the configuration specification for supported autologin and auto-assign
// configuration based on the provided HTTP request condition registry.
func Spec(reg *httpcond.Registry) conf.OptionRegistry {
	return &confutil.MultiOptionRegistry{
		commonSpec,
		reg,
	}
}
