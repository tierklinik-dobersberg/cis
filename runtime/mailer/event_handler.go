package mailer

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/service/runtime"
)

type eventHandler struct {
	mailer Mailer
	msg    Message
}

// HandleEvents implements trigger.Handler.
func (eh *eventHandler) HandleEvents(ctx context.Context, events ...*event.Event) error {
	// TODO(ppacher): consider adding something similar to AcceptBuffered= from
	// runtime/twilio.
	// For now, we just send emails for each matching event.
	errors := new(multierr.Error)
	for _, evt := range events {
		if err := eh.mailer.Send(ctx, eh.msg, evt); err != nil {
			errors.Add(err)
			log.From(ctx).Errorf("failed to send mail: %w", err)
		}
	}
	return errors.ToError()
}

// AddTriggerType registers a "SendMail" trigger on reg using typeName.
func AddTriggerType(typeName string, reg *trigger.Registry) error {
	return reg.RegisterType(typeName, &trigger.Type{
		OptionRegistry: confutil.MultiOptionRegistry{
			confutil.MakeOptional(AccountSpec),
			MessageSpec,
		},
		CreateFunc: func(c context.Context, cs *runtime.ConfigSchema, s *conf.Section) (trigger.Handler, error) {
			var (
				acc Account
				msg Message
			)
			// detect if the account is configured in s by checking
			// if Host= is set
			if _, err := s.GetString("Host"); err == nil {
				if err := conf.DecodeSections([]conf.Section{*s}, AccountSpec, &acc); err != nil {
					return nil, fmt.Errorf("parsing account: %w", err)
				}
			} else {
				if err := cs.Decode("Mailer", &acc); err != nil {
					return nil, fmt.Errorf("parsing global account: %w", err)
				}
			}
			if err := conf.DecodeSections([]conf.Section{*s}, MessageSpec, &msg); err != nil {
				return nil, fmt.Errorf("parsing message: %w", err)
			}
			msg.BodyFile = confutil.AbsConfig(msg.BodyFile)

			// TODO(ppacher): validate account
			mailer, err := New(acc)
			if err != nil {
				return nil, fmt.Errorf("mailer: %w", err)
			}
			return &eventHandler{
				mailer: mailer,
				msg:    msg,
			}, nil
		},
	})
}
