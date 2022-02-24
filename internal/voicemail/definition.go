package voicemail

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/mailbox"
)

// Definition describes a mailbox that receives voice-mails.
type Definition struct {
	Name                string
	Disabled            bool
	ExtractCallerRegexp string
	ExtractTargetRegexp string
	mailbox.Config
}

// Spec defines the configuration stanzas used to configure
// a VoiceMail mailbox.
var Spec = conf.SectionSpec(append([]conf.OptionSpec{
	{
		Name:        "Name",
		Type:        conf.StringType,
		Description: "The name of the voicemail",
		Required:    true,
	},
	{
		Name:        "Disabled",
		Type:        conf.BoolType,
		Default:     "no",
		Description: "Whether or not the watching of the specified mailbox is disabled.",
	},
	{
		Name:     "ExtractCallerRegexp",
		Type:     conf.StringType,
		Required: true,
	},
	{
		Name: "ExtractTargetRegexp",
		Type: conf.StringType,
	},
}, mailbox.MailboxInfoSpec...))
