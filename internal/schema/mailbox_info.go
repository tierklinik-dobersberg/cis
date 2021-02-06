package schema

import "github.com/ppacher/system-conf/conf"

// MailboxInfo holds configuration values to connect to a
// IMAP mailbox.
type MailboxInfo struct {
	Host               string
	TLS                bool
	InsecureSkipVerify bool
	User               string
	Password           string
	Folder             string
	ReadOnly           bool
}

// MailboxInfoSpec describes the settings used to configure
// a IMAP mailbox.
var MailboxInfoSpec = conf.SectionSpec{
	{
		Name:        "Host",
		Description: "The hostname of the IMAP mailbox server (including port)",
		Required:    true,
		Type:        conf.StringType,
	},
	{
		Name:        "TLS",
		Description: "Whether or not TLS should be used.",
		Default:     "yes",
		Type:        conf.BoolType,
	},
	{
		Name:        "InsecureSkipVerify",
		Description: "Insecurely skip certificate validation",
		Default:     "no",
		Type:        conf.BoolType,
	},
	{
		Name:        "User",
		Description: "The username of the mailbox",
		Type:        conf.StringType,
	},
	{
		Name:        "Password",
		Description: "The password for the mailbox",
		Type:        conf.StringType,
	},
	{
		Name:        "Folder",
		Description: "The mailbox folder",
		Type:        conf.StringType,
		Default:     "INBOX",
	},
	{
		Name:        "ReadOnly",
		Description: "Whether or not the mailbox should be opened readonly",
		Type:        conf.BoolType,
		Default:     "yes",
	},
}
