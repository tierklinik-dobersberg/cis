package webhook

import (
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type Definition struct {
	Method        string
	Address       string
	AllowInsecure bool
	Body          string
	Headers       []string
	Timeout       time.Duration
}

var Spec = conf.SectionSpec{
	{
		Name:        "Method",
		Type:        conf.StringType,
		Default:     "POST",
		Description: "The HTTP verb to use for the webhook",
		Annotations: new(conf.Annotation).With(
			runtime.OneOf(
				runtime.PossibleValue{
					Value: "GET",
				},
				runtime.PossibleValue{
					Value: "POST",
				},
				runtime.PossibleValue{
					Value: "PUT",
				},
				runtime.PossibleValue{
					Value: "PATCH",
				},
				runtime.PossibleValue{
					Value: "DELETE",
				},
			),
		),
	},
	{
		Name:        "Address",
		Type:        conf.StringType,
		Required:    true,
		Description: "The HTTP URL for the Webhook",
	},
	{
		Name:        "AllowInsecure",
		Type:        conf.BoolType,
		Default:     "no",
		Description: "Whether or not self-signed certificates should be accepted.",
	},
	{
		Name:        "Body",
		Type:        conf.StringType,
		Description: "The body to send. Support th Go template languate.",
		Annotations: new(conf.Annotation).With(
			runtime.StringFormat("text/plain"),
		),
	},
	{
		Name:        "Headers",
		Type:        conf.StringSliceType,
		Description: "A list of headers in the format HEADER: VALUE for the webhook",
	},
	{
		Name:        "Timeout",
		Type:        conf.DurationType,
		Description: "Maximum amount of time before the webhook is cancelled",
		Default:     "10s",
	},
}
