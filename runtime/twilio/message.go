package twilio

import "github.com/ppacher/system-conf/conf"

type Message struct {
	From         string
	To           []string
	Template     string
	TemplateFile string
}

var MessageSpec = conf.SectionSpec{
	{
		Name:        "From",
		Type:        conf.StringType,
		Description: "The send number or identification code",
	},
	{
		Name:        "To",
		Type:        conf.StringSliceType,
		Description: "One or more receipient phone numbers",
		Required:    true,
	},
	{
		Name:        "Template",
		Type:        conf.StringType,
		Description: "The message template using Golang text/template",
	},
	{
		Name:        "TemplateFile",
		Type:        conf.StringType,
		Description: "A template file for the message body using Golang text/template.",
	},
}
