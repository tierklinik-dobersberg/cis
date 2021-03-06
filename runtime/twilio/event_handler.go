package twilio

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/service/runtime"
)

var eventTriggerSpec = conf.SectionSpec{
	{
		Name:        "AcceptBuffered",
		Type:        conf.BoolType,
		Default:     "no",
		Description: "Whether or not the template accepts buffered events. That is, a sice of events is passed instead of a single one.",
	},
}

func AddTriggerType(name string, reg *trigger.Registry) error {
	return reg.RegisterType(name, &trigger.Type{
		OptionRegistry: utils.MultiOptionRegistry{
			// Within the trigger file all stanzas for the account
			// are optional.
			utils.MakeOptional(AccountSpec),
			MessageSpec,
			eventTriggerSpec,
		},
		CreateFunc: func(ctx context.Context, globalCfg *runtime.ConfigSchema, s *conf.Section) (trigger.Handler, error) {
			spec := utils.MultiOptionRegistry{
				eventTriggerSpec,
				MessageSpec,
			}
			// Decode the Message and eventHandlerSpec into ev
			var ev = new(EventHandler)
			if err := conf.DecodeSections([]conf.Section{*s}, spec, ev); err != nil {
				return nil, fmt.Errorf("failed to parse section: %w", err)
			}

			ev.Message.TemplateFile = utils.AbsConfig(ev.Message.TemplateFile)

			// detect the twilio account configuration. if AccountSid is defined
			// in the Twilio trigger section we'll use that one. If not, we'll
			// try to use the global one.
			var acc Account
			if _, err := s.GetString("AccountSid"); err == nil {
				if err := conf.DecodeSections([]conf.Section{*s}, AccountSpec, &acc); err != nil {
					return nil, fmt.Errorf("failed to decode twilio account settings: %w", err)
				}
			} else {
				if err := globalCfg.Decode("Twilio", &acc); err != nil {
					return nil, fmt.Errorf("failed to decode global twilio account section: %w", err)
				}
			}

			sender, err := New(acc)
			if err != nil {
				return nil, fmt.Errorf("account: %w", err)
			}
			ev.sender = sender

			return ev, nil
		},
	})
}

type EventHandler struct {
	AcceptBuffered bool
	Message
	sender SMSSender
}

func (ev *EventHandler) HandleEvents(ctx context.Context, evts ...*event.Event) {
	log := log.From(ctx)

	if ev.AcceptBuffered {
		if err := ev.sender.Send(ctx, ev.Message, evts); err != nil {
			log.Errorf("failed to send SMS: %s", err)
		}
		return
	}

	for _, evt := range evts {
		if err := ev.sender.Send(ctx, ev.Message, evt); err != nil {
			log.Errorf("failed to send SMS: %s", err)
		}
	}
}
