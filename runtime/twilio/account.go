package twilio

import "github.com/ppacher/system-conf/conf"

type Account struct {
	From       string
	AccountSid string
	Token      string
}

var AccountSpec = conf.SectionSpec{
	{
		Name:        "From",
		Type:        conf.StringType,
		Required:    true,
		Description: "The sender number or alphanumeric sender ID",
	},
	{
		Name:        "AccountSid",
		Type:        conf.StringType,
		Required:    true,
		Internal:    true,
		Description: "The Twilio Account SID",
	},
	{
		Name:        "Token",
		Type:        conf.StringType,
		Required:    true,
		Internal:    true,
		Description: "The Twilio authentication token",
		Annotations: new(conf.Annotation).With(
			conf.SecretValue(),
		),
	},
}
