package schema

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/mailbox"
)

// VoiceMail describes a mailbox that receives voice-mails.
type VoiceMail struct {
	Name                string
	ExtractCallerRegexp string
	ExtractTargetRegexp string
	mailbox.Config
}

// VoiceMailSpec defines the configuration stanzas used to configure
// a VoiceMail mailbox.
var VoiceMailSpec = conf.SectionSpec(append([]conf.OptionSpec{
	{
		Name:        "Name",
		Type:        conf.StringType,
		Description: "The name of the voicemail",
		Required:    true,
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
