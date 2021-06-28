package session

import (
	"time"

	"github.com/ppacher/system-conf/conf"
)

// IdentityConfig groups configuration variables related to
// identity handling and the api/identity endpoint.
type IdentityConfig struct {
	Audience           string
	Issuer             string
	SigningMethod      string
	AccessTokenCookie  string
	RefreshTokenCookie string
	CookieDomain       string
	AccessTokenTTL     time.Duration
	RefreshTokenTTL    time.Duration
	InsecureCookies    bool
	AvatarDirectory    string
}

// IdentityConfigSpec defines the available configuration values for the
// [Identity] configuration section.
var IdentityConfigSpec = conf.SectionSpec{
	{
		Name:        "Issuer",
		Description: "The issuer value to use for JWT tokens",
		Type:        conf.StringType,
		Default:     "cisd",
	},
	{
		Name:        "Audience",
		Description: "The value for the JWT token audience",
		Type:        conf.StringType,
		Default:     "cisd",
	},
	{
		Name:        "SigningMethod",
		Description: "The signing method for JWT. Valid valus are HS256, HS384, HS512",
		Type:        conf.StringType,
		Default:     "HS256",
	},
	{
		Name:        "AccessTokenCookie",
		Default:     "cis-session",
		Description: "Name of the session cookie",
		Type:        conf.StringType,
	},
	{
		Name:        "RefreshTokenCookie",
		Default:     "cis-refresh",
		Description: "Name of the refresh token cookie",
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
	{
		Name:        "AccessTokenTTL",
		Description: "Duration an access token is considered valid",
		Type:        conf.DurationType,
		Default:     "1h",
	},
	{
		Name:        "RefreshTokenTTL",
		Description: "Duration a refresh token is considered valid",
		Type:        conf.DurationType,
		Default:     "24h",
	},
}
