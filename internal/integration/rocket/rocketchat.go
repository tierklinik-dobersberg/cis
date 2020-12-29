package rocket

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
)

type (
	// AttachmentField is a keyval pair that is displayed
	// in a Rocket.Chat attachment.
	AttachmentField struct {
		Title string `json:"title"`
		Value string `json:"value"`
		Short bool   `json:"short"`
	}

	// Attachment is a grouped set of information attached
	// to a Rocket.Chat message. Multiple attachments can
	// be part of a message. Rocket.Chat allows attachments
	// to be expanded or collapsed.
	Attachment struct {
		Title     string            `json:"title,omitempty"`
		Text      string            `json:"text,omitempty"`
		Color     string            `json:"color,omitempty"`
		Collapsed bool              `json:"collapsed,omitempty"`
		Fields    []AttachmentField `json:"fields,omitempty"`
	}

	// WebhookContent defines the structure of a webhook
	// as expected by Rocket.Chat.
	WebhookContent struct {
		Username    string       `json:"username,omitempty"`
		IconEmoji   string       `json:"icon_emoji,omitempty"`
		Text        string       `json:"text,omitempty"`
		Attachments []Attachment `json:"attachments,omitempty"`
	}

	// Client is a simple Rocket.Chat webhook client that supports
	// sending webhooks to a Rocket.Chat instance.
	Client struct {
		cli *http.Client
		url *url.URL
	}
)

// NewClient returns a new Rocket.Chat webhook client. It sends
// webhooks to addr. If httpClient is nil http.DefaultClient will
// be used.
func NewClient(addr string, httpClient *http.Client) (*Client, error) {
	u, err := url.Parse(addr)
	if err != nil {
		return nil, err
	}

	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &Client{
		cli: httpClient,
		url: u,
	}, nil
}

// Send sends webhook to rocket chat.
func (cli *Client) Send(ctx context.Context, payload WebhookContent) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", cli.url.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}

	res, err := cli.cli.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	content, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return err
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("received unexpected response: %s %q", res.Status, string(content))
	}
	return nil
}
