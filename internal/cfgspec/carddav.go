package cfgspec

import "github.com/ppacher/system-conf/conf"

type CardDAVConfig struct {
	// ID is used to uniquely identify the CardDAV config
	// and is used to persist the sync-tokens.
	ID string
	// Schedule describes the sync/import schedule using
	// cron syntax.
	Schedule string
	// Server holds the URL of the CardDAV server.
	Server string
	// AllowInsecure can be set to true to disable
	// TLS certificate checks.
	AllowInsecure bool
	// User is the username required for HTTP Basic
	// authentication.
	User string
	// Password is the password required for HTTP Basic
	// authentication.
	Password string
	// AddressBook is the name of the adressbook to use.
	// If left empty the default address book of the
	// authenticated user discovered.
	AddressBook string
}

var CardDAVSpec = conf.SectionSpec{
	{
		Name:        "ID",
		Description: "ID uniquely identifies this CardDAV configuration and is used to perist the sync tokens",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "Schedule",
		Description: "A cron-like schedule to import customers from CardDAV",
		Default:     "@every 6h",
		Type:        conf.StringType,
	},
	{
		Name:        "Server",
		Description: "The URL of the CardDAV server.",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "AllowInsecure",
		Description: "Wether or not insecure TLS server certificates should be accepted.",
		Type:        conf.BoolType,
	},
	{
		Name:        "User",
		Description: "The username required for HTTP Basic authentication",
		Type:        conf.StringType,
	},
	{
		Name:        "Password",
		Description: "The password required for HTTP Basic authentication",
		Type:        conf.StringType,
	},
	{
		Name:        "AddressBook",
		Description: "The name of the target address book. If unspecified, CIS will try to auto-detect the default address book of the authenticated user.",
		Type:        conf.StringType,
	},
}
