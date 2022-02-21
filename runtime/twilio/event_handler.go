package twilio

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
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
		OptionRegistry: confutil.MultiOptionRegistry{
			MessageSpec,
			eventTriggerSpec,
		},
		CreateFunc: func(ctx context.Context, globalCfg *runtime.ConfigSchema, s *conf.Section) (trigger.Handler, error) {
			spec := confutil.MultiOptionRegistry{
				eventTriggerSpec,
				MessageSpec,
			}
			// Decode the Message and eventHandlerSpec into ev
			var ev = &EventHandler{
				cs: globalCfg,
			}
			if err := conf.DecodeSections([]conf.Section{*s}, spec, ev); err != nil {
				return nil, fmt.Errorf("failed to parse section: %w", err)
			}

			ev.Message.TemplateFile = confutil.AbsConfig(ev.Message.TemplateFile)

			return ev, nil
		},
	})
}

type EventHandler struct {
	AcceptBuffered bool
	Message
	cs *runtime.ConfigSchema
}

func (ev *EventHandler) HandleEvents(ctx context.Context, evts ...*event.Event) error {
	log := log.From(ctx)
	errors := new(multierr.Error)

	var acc Account
	if err := ev.cs.DecodeSection(ctx, "Twilio", &acc); err != nil {
		return fmt.Errorf("failed to get twilio configuration: %w", err)
	}

	sender, err := New(acc)
	if err != nil {
		return fmt.Errorf("failed to create twilio sender from configuration: %w", err)
	}

	if ev.AcceptBuffered {
		if err := sender.Send(ctx, ev.Message, evts); err != nil {
			errors.Add(err)
			log.Errorf("failed to send SMS: %s", err)
		}

		return errors.ToError()
	}

	for _, evt := range evts {
		if err := sender.Send(ctx, ev.Message, evt); err != nil {
			errors.Add(err)
			log.Errorf("failed to send SMS: %s", err)
		}
	}

	return errors.ToError()
}
