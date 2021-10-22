package twilio

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"sync"
	"text/template"

	"github.com/kevinburke/twilio-go"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
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
		defaultFrom:   acc.From,
		client:        client,
		templateCache: make(map[string]*template.Template),
	}, nil
}

type sender struct {
	client        *twilio.Client
	defaultFrom   string
	l             sync.Mutex
	templateCache map[string]*template.Template
}

func (s *sender) Send(ctx context.Context, msg Message, context interface{}) error {
	if msg.From == "" {
		msg.From = s.defaultFrom
	}

	t, err := s.cacheTemplate(ctx, msg)
	if err != nil {
		return err
	}

	var buf = new(bytes.Buffer)
	if err := t.Execute(buf, context); err != nil {
		return fmt.Errorf("executing template: %w", err)
	}

	for _, to := range msg.To {
		_, err := s.client.Messages.SendMessage(msg.From, to, buf.String(), nil)
		if err != nil {
			return fmt.Errorf("sending message to %s: %w", to, err)
		}
	}

	return nil
}

func (s *sender) cacheTemplate(ctx context.Context, msg Message) (*template.Template, error) {
	key := "template: " + msg.Template
	if msg.TemplateFile != "" {
		key = "file: " + msg.TemplateFile
	}

	s.l.Lock()
	defer s.l.Unlock()
	if t, ok := s.templateCache[key]; ok {
		return t, nil
	}

	body := msg.Template
	if msg.TemplateFile != "" {
		blob, err := ioutil.ReadFile(msg.TemplateFile)
		if err != nil {
			return nil, fmt.Errorf("template-file: %w", err)
		}
		body = string(blob)
	}

	t, err := template.New("sms").Parse(body)
	if err != nil {
		return nil, fmt.Errorf("parsing template: %w", err)
	}

	s.templateCache[key] = t
	return t, nil
}

// compile time check.
var _ SMSSender = new(sender)
