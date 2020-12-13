package schema

import (
	"github.com/ppacher/system-conf/conf"
)

type GlobalConfig struct {
	Secret          string
	CookieName      string
	CookieDomain    string
	InsecureCookies bool
	AccessLogFile   string
	AvatarDirectory string
}

// GlobalConfigSpec defines the available configuration values for the
// [Global] configuration section.
var GlobalConfigSpec = []conf.OptionSpec{
	{
		Name:        "Secret",
		Description: "Secret used to sign session cookies. If empty, a temporary secret is created.",
		Type:        conf.StringType,
	},
	{
		Name:        "CookieName",
		Default:     "userhub",
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
		Name:        "AccessLogFile",
		Description: "Path to access lo file",
		Type:        conf.StringType,
	},
	{
		Name:        "AvatarDirectory",
		Description: "Path to avatar storage directory",
		Type:        conf.StringType,
	},
}
