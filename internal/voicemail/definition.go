package voicemail

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/mailbox"
)

var (
	configBuilder = runtime.NewConfigSchemaBuilder(addVoicemail)

	AddToSchema = configBuilder.AddToSchema
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

func addVoicemail(rtSchema *runtime.ConfigSchema) error {
	return rtSchema.Register(runtime.Schema{
		Name:        "VoiceMail",
		DisplayName: "Voice-Mails",
		Description: "Configure voicemail mailboxes",
		Spec:        Spec,
		Multi:       true,
		Annotations: new(conf.Annotation).With(
			runtime.OverviewFields("Name", "Disabled", "Host", "User", "Password"),
		),
		SVGData: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />`,
	})
}

func init() {
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
