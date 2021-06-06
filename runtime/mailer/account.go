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
}
