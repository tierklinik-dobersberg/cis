// Package cisapi provides a client for the HTTP REST API of the
// cis daemon.
package cisapi

import (
	"context"
	"fmt"
	"io"
	"net/http"
)

// Client describes the method landscape of a cisapi client.
type Client interface {
}

// client actually implements the Client interface.
type client struct {
	httpClient  *http.Client
	baseUrl     string
	reqWrappers []requestWrapperFunc
}

// requestWrapperFunc can be used to alter a HTTP request before it is
// sent to CIS.
type requestWrapperFunc func(r *http.Request) (*http.Request, error)

// Option is an option that can be passed to NewClient to alter
// the default behavior.
type Option func(cli *client) error

// NewClient creates a new CIS API client.
func NewClient(baseUrl string, opts ...Option) (Client, error) {
	cli := &client{
		baseUrl: baseUrl,
	}

	for _, opt := range opts {
		if err := opt(cli); err != nil {
			return nil, fmt.Errorf("failed to apply option: %w", err)
		}
	}

	// fallback to the DefaultClient if none is given using opts
	if cli.httpClient == nil {
		cli.httpClient = http.DefaultClient
	}

	return cli, nil
}

// prepareRequest prepares a new HTTP request using method on endpoint. The endpoint passed to this
// function is expected to be relative to the CIS API root. That is, if CIS API is listening on
// http://localhost:4000/api and the target endpoint is http://localhost:4000/api/customers/v1/ that
// endpoint should be set to "customers/v1". The ctx and body parameters are passed to http.NewRequestWithContext
// as they are. All registered request wrappers of the client are applied in order.
func (cli *client) prepareRequest(ctx context.Context, method string, endpoint string, body io.Reader) (*http.Request, error) {
	url := fmt.Sprintf("%s/%s", cli.baseUrl, endpoint)
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	for _, fn := range cli.reqWrappers {
		req, err = fn(req)
		if err != nil {
			return nil, err
		}
	}

	return req, nil
}
