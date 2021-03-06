package mailer

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"strings"
	"sync"

	htmlTemplate "html/template"
	textTemplate "text/template"

	"github.com/ory/mail/v3"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("mailer")

type Mailer interface {
	Send(ctx context.Context, msg Message, context interface{}) error
}

type mailer struct {
	dialer        *mail.Dialer
	defaultFrom   string
	l             sync.Mutex
	templateCache map[string]templater // TODO(ppacher): check LStat for modification
}

// templater defines the required method landscape that is
// implemented by text/template and html/template.
type templater interface {
	Execute(io.Writer, interface{}) error
}

func (m *mailer) Send(ctx context.Context, email Message, context interface{}) error {
	if email.From == "" {
		email.From = m.defaultFrom
	}

	msg := mail.NewMessage()
	msg.SetHeaders(map[string][]string{
		"From":    {email.From},
		"To":      email.To,
		"CC":      email.CC,
		"Subject": {email.Subject},
	})

	t, err := m.cacheBodyTemplate(ctx, email)
	if err != nil {
		return err
	}

	msg.SetBodyWriter(email.BodyContentType, func(w io.Writer) error {
		return t.Execute(w, context)
	})

	if err := m.dialer.DialAndSend(ctx, msg); err != nil {
		return fmt.Errorf("send-mail: %w", err)
	}

	return nil
}

func (m *mailer) cacheBodyTemplate(ctx context.Context, email Message) (templater, error) {
	key := "_content:" + email.Body
	if email.BodyFile != "" {
		key = "_file:" + email.BodyFile
	}

	m.l.Lock()
	defer m.l.Unlock()

	t, ok := m.templateCache[key]
	if !ok {
		templateContent := email.Body
		if email.BodyFile != "" {
			content, err := ioutil.ReadFile(email.BodyFile)
			if err != nil {
				return nil, fmt.Errorf("body-file: %w", err)
			}
			templateContent = string(content)
		}
		if strings.Contains(email.BodyContentType, "text/plain") {
			_t, err := textTemplate.
				New("email").
				Parse(templateContent)
			if err != nil {
				return nil, fmt.Errorf("parse text/template: %w", err)
			}
			t = _t
		} else {
			// print a warning if the content-type does not explicitly specify text/html
			if !strings.Contains(email.BodyContentType, "text/html") {
				log.From(ctx).V(1).Logf("using html/template for body content type %s", email.BodyContentType)
			}
			_t, err := htmlTemplate.
				New("email").
				Parse(templateContent)
			if err != nil {
				return nil, fmt.Errorf("parse html/template: %w", err)
			}
			t = _t
		}
		m.templateCache[key] = t
	}
	return t, nil
}

// New returns a new mailer that sends mail through account.
func New(account Account) (Mailer, error) {
	d := mail.NewDialer(account.Host, account.Port, account.Username, account.Password)

	// TODO(ppacher): should we try to connect to verify the credentials?
	return &mailer{
		dialer:        d,
		defaultFrom:   account.From,
		templateCache: make(map[string]templater),
	}, nil
}
