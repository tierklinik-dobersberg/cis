package mailsync

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"mime"
	"mime/multipart"
	"net/mail"
	"strings"
	"time"

	"github.com/mxk/go-imap/imap"
	"github.com/paulrosania/go-charset/charset"
	_ "github.com/paulrosania/go-charset/data"
	"github.com/sloonz/go-qprintable"
)

type EMail struct {
	Message *mail.Message `json:"-"`

	From         *mail.Address   `json:"from"`
	To           []*mail.Address `json:"to"`
	InternalDate time.Time       `json:"internalDate"`
	Precedence   string          `json:"precedence"`
	Subject      string          `json:"subject"`
	HTML         []byte          `json:"html"`
	Text         []byte          `json:"text"`
	MultiPart    bool            `json:"multiPart"`
	UID          uint32          `json:"uid"`
}

func MailFromFields(fields imap.FieldMap) (*EMail, error) {
	// copy the email in it's raw form to a buffer
	rawMail := new(bytes.Buffer)
	rawMail.Write(imap.AsBytes(fields["RFC822.HEADER"]))
	rawMail.Write([]byte("\n\n"))
	rawBody := imap.AsBytes(fields["BODY[]"])
	rawMail.Write(rawBody)

	m, err := mail.ReadMessage(rawMail)
	if err != nil {
		return nil, fmt.Errorf("parsing mail: %w", err)
	}

	from, err := mail.ParseAddress(m.Header.Get("From"))
	if err != nil {
		return nil, fmt.Errorf("parsing From: %w", err)
	}

	to, err := m.Header.AddressList("To")
	if err != nil {
		return nil, fmt.Errorf("parsing To: %w", err)
	}

	result := &EMail{
		Message:      m,
		InternalDate: imap.AsDateTime(fields["INTERNALDATE"]),
		Precedence:   m.Header.Get("Precedence"),
		From:         from,
		To:           to,
		Subject:      parseSubject(m.Header.Get("Subject")),
		UID:          imap.AsNumber(fields["UID"]),
	}

	result.HTML, result.Text, result.MultiPart, err = parseBody(m.Header, rawBody)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func hasEncoding(word string) bool {
	return strings.Contains(word, "=?") && strings.Contains(word, "?=")
}

func isEncodedWord(word string) bool {
	return strings.HasPrefix(word, "=?") && strings.HasSuffix(word, "?=") && strings.Count(word, "?") == 4
}

func parseSubject(subject string) string {
	if !hasEncoding(subject) {
		return subject
	}

	dec := mime.WordDecoder{}
	sub, _ := dec.DecodeHeader(subject)
	return sub
}

var headerSplitter = []byte("\r\n\r\n")

// parseBody will accept a a raw body, break it into all its parts and then convert the
// message to UTF-8 from whatever charset it may have.
func parseBody(header mail.Header, body []byte) (html []byte, text []byte, isMultipart bool, err error) {
	var mediaType string
	var params map[string]string
	mediaType, params, err = mime.ParseMediaType(header.Get("Content-Type"))
	if err != nil {
		return
	}

	if strings.HasPrefix(mediaType, "multipart/") {
		isMultipart = true
		mr := multipart.NewReader(bytes.NewReader(body), params["boundary"])
		for {
			p, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}

			slurp, err := ioutil.ReadAll(p)
			if err != nil {
				// error and no results to use
				if len(slurp) == 0 {
					break
				}
			}

			partMediaType, partParams, err := mime.ParseMediaType(p.Header.Get("Content-Type"))
			if err != nil {
				break
			}

			var htmlT, textT []byte
			htmlT, textT, err = parsePart(partMediaType, partParams["charset"], p.Header.Get("Content-Transfer-Encoding"), slurp)
			if len(htmlT) > 0 {
				html = htmlT
			} else {
				text = textT
			}
		}
	} else {

		splitBody := bytes.SplitN(body, headerSplitter, 2)
		if len(splitBody) < 2 {
			err = errors.New("unexpected email format. (single part and no \\r\\n\\r\\n separating headers/body")
			return
		}

		body = splitBody[1]
		html, text, err = parsePart(mediaType, params["charset"], header.Get("Content-Transfer-Encoding"), body)
	}
	return
}

func parsePart(mediaType, charsetStr, encoding string, part []byte) (html, text []byte, err error) {
	// deal with charset
	if strings.ToLower(charsetStr) == "iso-8859-1" {
		var cr io.Reader
		cr, err = charset.NewReader("latin1", bytes.NewReader(part))
		if err != nil {
			return
		}

		part, err = ioutil.ReadAll(cr)
		if err != nil {
			return
		}
	}

	// deal with encoding
	var body []byte
	switch strings.ToLower(encoding) {
	case "quoted-printable":
		dec := qprintable.NewDecoder(qprintable.WindowsTextEncoding, bytes.NewReader(part))
		body, err = ioutil.ReadAll(dec)
		if err != nil {
			return
		}
	case "base64":
		decoder := base64.NewDecoder(base64.StdEncoding, bytes.NewReader(part))
		body, err = ioutil.ReadAll(decoder)
		if err != nil {
			return
		}
	default:
		body = part
	}

	// deal with media type
	mediaType = strings.ToLower(mediaType)
	switch {
	case strings.Contains(mediaType, "text/html"):
		html = body
	case strings.Contains(mediaType, "text/plain"):
		text = body
	}
	return
}
