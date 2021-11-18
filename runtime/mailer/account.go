package mailer

import "github.com/ppacher/system-conf/conf"

type Account struct {
	// Host should holds the SMPT host name the mailer should
	// use to send mails.
	Host string
	// Port should holds the SMTP port the host is listening on.
	Port int
	// Username required for authentication.
	Username string
	// Password required for authentication.
	Password string
	// From defines the default sender to use for this account.
	From string
	// AllowInsecure can be set to true to disable TLS certificate
	// verification.
	AllowInsecure bool
	// UseSSL can be set to either true or false to force SSL to be enabled
	// or disabled. If not configured, SSL will be used for the default
	// SSL port.
	UseSSL *bool
}

// AccountSpec is defines the configuration stanzas for a mailer Account.
var AccountSpec = conf.SectionSpec{
	{
		Name:        "Host",
		Required:    true,
		Description: "The hostname of the outgoing mail server",
		Type:        conf.StringType,
	},
	{
		Name:        "Port",
		Required:    true,
		Default:     "587",
		Description: "The port of the outgoing mail server",
		Type:        conf.IntType,
	},
	{
		Name:        "Username",
		Description: "The username for the SMPT server authentication.",
		Type:        conf.StringType,
	},
	{
		Name:        "Password",
		Description: "The password of the user.",
		Type:        conf.StringType,
	},
	{
		Name:        "From",
		Description: "The default sender to use",
		Type:        conf.StringType,
	},
	{
		Name:        "AllowInsecure",
		Type:        conf.BoolType,
		Description: "If set to true, the certificate of the upstream SMTP server is not verified.",
		Default:     "no",
	},
	{
		Name:        "UseSSL",
		Type:        conf.BoolType,
		Description: "Whether or not SSL should be enabled or disabled. Leave empty for the default",
	},
}
