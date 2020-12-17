package schema

import (
	"github.com/ppacher/system-conf/conf"
)

type IdentityConfig struct {
	CookieName      string
	CookieDomain    string
	InsecureCookies bool
	AvatarDirectory string
}

// IdentityConfigSpec defines the available configuration values for the
// [Identity] configuration section.
var IdentityConfigSpec = []conf.OptionSpec{
	{
		Name:        "CookieName",
		Default:     "cis",
		Description: "Name of the session cookie",
		Type:        conf.StringType,
	},
	{
		Name:        "CookieDomain",
		Required:    true,
		Description: "The domain for which session cookies should be created",
		Type:        conf.StringType,
	},
	{
		Name:        "InsecureCookies",
		Default:     "no",
		Description: "Wether or not the session cookie should be HTTPS only",
		Type:        conf.BoolType,
	},
	{
		Name:        "AvatarDirectory",
		Description: "Path to avatar storage directory",
		Type:        conf.StringType,
	},
}
