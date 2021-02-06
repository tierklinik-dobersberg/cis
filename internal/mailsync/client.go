// This file is heavily inspired by github.com/jprobinson/eazy

package mailsync

import (
	"crypto/tls"
	"fmt"
	"time"

	"github.com/mxk/go-imap/imap"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
)

// IMAPDateFormat is the date format used for IMAP SINCE.
const IMAPDateFormat = "02-Jan-2006"

// Connect returns a new IMAP client for the mailbox configured
// in info.
func Connect(info schema.MailboxInfo) (*imap.Client, error) {
	var (
		client *imap.Client
		err    error
	)
	if info.TLS {
		config := new(tls.Config)
		config.InsecureSkipVerify = info.InsecureSkipVerify
		client, err = imap.DialTLS(info.Host, config)
	} else {
		client, err = imap.Dial(info.Host)
	}

	if err != nil {
		return nil, fmt.Errorf("dialing: %w", err)
	}

	if info.User != "" {
		if _, err := client.Login(info.User, info.Password); err != nil {
			return nil, fmt.Errorf("authenticating: %w", err)
		}
	}

	if _, err := imap.Wait(client.Select(info.Folder, info.ReadOnly)); err != nil {
		return nil, fmt.Errorf("selecting mailbox %q: %w", info.Folder, err)
	}

	return client, nil
}

// SearchUIDs performs an IMAP UIDSearch on cli and supports searching mails that arrived
// since a given time. If since is the zero time value it will be ignored.
func SearchUIDs(cli *imap.Client, search string, since time.Time) (*imap.Command, error) {
	var specs []imap.Field
	if len(search) > 0 {
		specs = append(specs, search)
	}

	if !since.IsZero() {
		sinceStr := since.Format(IMAPDateFormat)
		specs = append(specs, "SINCE", sinceStr)
	}

	cmd, err := imap.Wait(cli.UIDSearch(specs...))
	if err != nil {
		return nil, err
	}
	return cmd, nil
}

func FetchUIDRange(cli *imap.Client, seq *imap.SeqSet, markAsRead bool, delete bool) error {
	if seq.Empty() {
		return nil
	}

	fetchCommand, err := imap.Wait(
		cli.UIDFetch(
			seq,
			"INTERNALDATE",
			"BODY[]",
			"UID",
			"RFC822.HEADER",
		),
	)
	if err != nil {
		return fmt.Errorf("fetching mails: %w", err)
	}

	for _, msgData := range fetchCommand.Data {
		msgFields := msgData.MessageInfo().Attrs

		// make sure is a legit response before we attempt to parse it
		// deal with unsolicited FETCH responses containing only flags
		// I'm lookin' at YOU, Gmail!
		// http://mailman13.u.washington.edu/pipermail/imap-protocol/2014-October/002355.html
		// http://stackoverflow.com/questions/26262472/gmail-imap-is-sometimes-returning-bad-results-for-fetch
		if _, ok := msgFields["RFC822.HEADER"]; !ok {
			continue
		}

	}

	return nil
}
