package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"

	"github.com/ory/mail/v3"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/pkg/tmpl"
)

var log = pkglog.New("mailer")

type Mailer interface {
	Send(ctx context.Context, msg Message, context interface{}) error
}

type mailer struct {
	dialer      *mail.Dialer
	defaultFrom string
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

	subj, err := tmpl.Render(ctx, email.Subject, context)
	if err != nil {
		return fmt.Errorf("failed to execute subject template: %w", err)
	}

	msg := mail.NewMessage()
	msg.SetHeaders(map[string][]string{
		"From":    {email.From},
		"To":      email.To,
		"Cc":      email.Cc,
		"Bcc":     email.Bcc,
		"Subject": {subj},
	})

	log.From(ctx).V(7).Logf("Sending mail %q to %s, cc=%v and bcc=%v", email.Subject, email.To, email.Cc, email.Bcc)

	msg.SetBodyWriter(email.BodyContentType, func(w io.Writer) error {
		return tmpl.RenderTo(ctx, email.Body, context, w)
	})

	if err := m.dialer.DialAndSend(ctx, msg); err != nil {
		return fmt.Errorf("send-mail: %w", err)
	}

	return nil
}

// New returns a new mailer that sends mail through account.
func New(account Account) (Mailer, error) {
	dialer := mail.NewDialer(account.Host, account.Port, account.Username, account.Password)

	if account.AllowInsecure {
		if dialer.TLSConfig == nil {
			dialer.TLSConfig = new(tls.Config)
		}
		dialer.TLSConfig.InsecureSkipVerify = true
	}

	if account.UseSSL != nil {
		dialer.SSL = *account.UseSSL
	}

	// TODO(ppacher): should we try to connect to verify the credentials?
	return &mailer{
		dialer:      dialer,
		defaultFrom: account.From,
	}, nil
}
