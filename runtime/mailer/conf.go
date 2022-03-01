package mailer

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type Message struct {
	From            string
	To              []string
	Cc              []string
	Bcc             []string
	Subject         string // text/template
	BodyContentType string
	Body            string // text/template
	BodyFile        string // text/template
}

var MessageSpec = conf.SectionSpec{
	{
		Name:        "From",
		Type:        conf.StringType,
		Description: "The sender email to use.",
	},
	{
		Name:        "To",
		Type:        conf.StringSliceType,
		Description: "Receipients for the message.",
		Required:    true,
	},
	{
		Name:        "Cc",
		Type:        conf.StringSliceType,
		Description: "Additional Cc receipients for the message. E-Mail addresses will be exposed to all receipients.",
	},
	{
		Name:        "Bcc",
		Type:        conf.StringSliceType,
		Description: "Additional blind Cc receipients for the message.",
	},
	{
		Name:        "Subject",
		Type:        conf.StringType,
		Description: "The subject of the email message.",
		Required:    true,
	},
	{
		Name:    "BodyContentType",
		Type:    conf.StringType,
		Default: "text/plain",
	},
	{
		Name:        "Body",
		Description: "The email body template. If used BodyFile= must be empty",
		Type:        conf.StringType,
		Annotations: new(conf.Annotation).With(
			runtime.StringFormat("text/plain"),
		),
	},
	{
		Name:        "BodyFile",
		Description: "Path to the email body template file. If used Body= must be empty",
		Type:        conf.StringType,
	},
}
