package twilio

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"text/template"

	"github.com/kevinburke/twilio-go"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
	"github.com/tierklinik-dobersberg/cis/internal/trigger"
)

var log = pkglog.New("twilio")

var Spec = conf.SectionSpec{
	{
		Name:        "From",
		Type:        conf.StringType,
		Required:    true,
		Description: "The sender number or alphanumeric sender ID",
	},
	{
		Name:        "To",
		Type:        conf.StringSliceType,
		Required:    true,
		Description: "Numbers that should be notified via SMS",
	},
	{
		Name:        "AccountSid",
		Type:        conf.StringType,
		Required:    true,
		Internal:    true,
		Description: "The twilio accound SID",
	},
	{
		Name:        "Token",
		Type:        conf.StringType,
		Required:    true,
		Internal:    true,
		Description: "The twilio authentication token",
	},
	{
		Name:        "AcceptBuffered",
		Type:        conf.BoolType,
		Default:     "no",
		Description: "Whether or not the template accepts buffered events. That is, a sice of events is passed instead of a single one.",
	},
	{
		Name:        "Template",
		Type:        conf.StringType,
		Description: "The golang text/template for the message body",
	},
	{
		Name:        "TemplateFile",
		Type:        conf.StringType,
		Description: "File path to the golang text/template for the message body",
	},
}

func init() {
	if err := RegisterTriggerOn(trigger.DefaultRegistry); err != nil {
		panic(err)
	}
}

func RegisterTriggerOn(reg *trigger.Registry) error {
	return reg.RegisterHandlerType("twilio", &trigger.Type{
		OptionRegistry: Spec,
		CreateFunc: func(c context.Context, s *conf.Section) (trigger.Handler, error) {
			var ev = new(EventHandler)
			if err := conf.DecodeSections([]conf.Section{*s}, Spec, ev); err != nil {
				return nil, fmt.Errorf("failed to parse section: %w", err)
			}

			if ev.Template == "" && ev.TemplateFile == "" {
				return nil, fmt.Errorf("missing Template= or TemplateFile= directive")
			}

			var templateContent = ev.Template
			if ev.TemplateFile != "" {
				content, err := ioutil.ReadFile(ev.TemplateFile)
				if err != nil {
					return nil, fmt.Errorf("error reading %s: %w", ev.TemplateFile, err)
				}
				templateContent = string(content)
			}

			t, err := template.New("").Parse(templateContent)
			if err != nil {
				return nil, fmt.Errorf("failed to parse template: %w", err)
			}

			ev.template = t
			ev.client = twilio.NewClient(ev.AccountSid, ev.Token, nil)

			return ev, nil
		},
	})
}

type EventHandler struct {
	From           string
	To             []string
	AccountSid     string
	Token          string
	Template       string
	TemplateFile   string
	AcceptBuffered bool

	template *template.Template
	client   *twilio.Client
}

func (ev *EventHandler) HandleEvents(ctx context.Context, evts ...*event.Event) {
	log := log.From(ctx)

	if ev.AcceptBuffered {
		buf := new(bytes.Buffer)
		if err := ev.template.Execute(buf, evts); err != nil {
			log.Errorf("failed to execute template for buffered events: %s", err)
			return
		}
		for _, to := range ev.To {
			if _, err := ev.client.Messages.SendMessage(ev.From, to, buf.String(), nil); err != nil {
				log.Errorf("failed to send message to %s: %s", to, err)
			}
		}
		return
	}

	for _, evt := range evts {
		buf := new(bytes.Buffer)

		if err := ev.template.Execute(buf, evt); err != nil {
			log.Errorf("failed to execute template: %s", err)
			continue
		}

		for _, to := range ev.To {
			_, err := ev.client.Messages.SendMessage(ev.From, to, buf.String(), nil)
			if err != nil {
				log.Errorf("failed to send message to %s: %s", to, err)
				continue
			}
		}
	}
}
