package twilio

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"text/template"

	"github.com/kevinburke/twilio-go"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/cis/internal/trigger"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/service/runtime"
)

var log = pkglog.New("twilio")

var Spec = conf.SectionSpec{
	{
		Name:        "To",
		Type:        conf.StringSliceType,
		Required:    true,
		Description: "Numbers that should be notified via SMS",
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
		OptionRegistry: utils.MultiOptionRegistry{
			// Within the trigger file all stanzas for the account
			// are optional.
			utils.MakeOptional(AccountSpec),
			Spec,
		},
		CreateFunc: func(ctx context.Context, globalCfg *runtime.ConfigSchema, s *conf.Section) (trigger.Handler, error) {
			app := app.FromContext(ctx)
			if app == nil {
				return nil, fmt.Errorf("expected app to exist in ctx")
			}

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

			// detect the twilio account configuration. if AccountSid is defined
			// in the Twilio trigger section we'll use that one. If not, we'll
			// try to use the global one.
			if _, err := s.GetString("AccountSid"); err == nil {
				if err := conf.DecodeSections([]conf.Section{*s}, AccountSpec, &ev.AccountConfig); err != nil {
					return nil, fmt.Errorf("failed to decode twilio account settings: %w", err)
				}
			} else {
				if err := globalCfg.Decode("Twilio", &ev.AccountConfig); err != nil {
					return nil, fmt.Errorf("failed to decode global twilio account section: %w", err)
				}
			}

			ev.template = t
			ev.client = twilio.NewClient(ev.AccountConfig.AccountSid, ev.AccountConfig.Token, nil)

			return ev, nil
		},
	})
}

type EventHandler struct {
	AccountConfig
	To             []string
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
