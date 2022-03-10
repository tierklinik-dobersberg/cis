package twilio

import (
	"context"
	"fmt"

	"github.com/kevinburke/twilio-go"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/pkg/tmpl"
)

var log = pkglog.New("twilio")

// SMSSender can send messages using the Twilio Programmable
// SMS interface.
type SMSSender interface {
	// Send sends msg and returns any error encountered.
	Send(ctx context.Context, msg Message, context interface{}) error
}

// New creates a new SMSSender using acc.
func New(acc Account) (SMSSender, error) {
	client := twilio.NewClient(acc.AccountSid, acc.Token, nil)

	return &sender{
		defaultFrom: acc.From,
		client:      client,
	}, nil
}

type sender struct {
	client      *twilio.Client
	defaultFrom string
}

func (s *sender) Send(ctx context.Context, msg Message, renderContext interface{}) error {
	if msg.From == "" {
		msg.From = s.defaultFrom
	}

	body, err := tmpl.Render(ctx, msg.Template, renderContext)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	for _, to := range msg.To {
		_, err := s.client.Messages.SendMessage(msg.From, to, body, nil)
		if err != nil {
			return fmt.Errorf("sending message to %s: %w", to, err)
		}
	}

	return nil
}

// compile time check.
var _ SMSSender = new(sender)
