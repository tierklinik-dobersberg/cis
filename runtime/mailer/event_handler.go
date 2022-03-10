package mailer

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

type eventHandler struct {
	cs  *runtime.ConfigSchema
	msg Message
}

// HandleEvents implements trigger.Handler.
func (eh *eventHandler) HandleEvents(ctx context.Context, events ...*event.Event) error {
	// TODO(ppacher): consider adding something similar to AcceptBuffered= from
	// runtime/twilio.
	// For now, we just send emails for each matching event.
	var acc Account

	if err := eh.cs.DecodeSection(ctx, "Mailer", &acc); err != nil {
		return fmt.Errorf("failed to get mailer configuration: %w", err)
	}

	mailer, err := New(acc)
	if err != nil {
		return fmt.Errorf("failed to create mailer from configuration: %w", err)
	}

	errors := new(multierr.Error)
	for _, evt := range events {
		if err := mailer.Send(ctx, eh.msg, evt); err != nil {
			errors.Add(err)
			log.From(ctx).Errorf("failed to send mail: %w", err)
		}
	}

	return errors.ToError()
}

// AddTriggerType registers a "SendMail" trigger on reg using typeName.
func AddTriggerType(reg *trigger.Registry) error {
	return reg.RegisterType(trigger.ActionType{
		Schema: runtime.Schema{
			Name:        "SendMail",
			Description: "Send an E-Mail to one or more receipients.",
			Spec:        MessageSpec,
		},
		CreateFunc: func(ctx context.Context, cs *runtime.ConfigSchema, s *conf.Section) (trigger.Handler, error) {
			var msg Message

			if err := conf.DecodeSections([]conf.Section{*s}, MessageSpec, &msg); err != nil {
				return nil, fmt.Errorf("parsing message: %w", err)
			}

			return &eventHandler{
				msg: msg,
				cs:  cs,
			}, nil
		},
	})
}
