package cisapi

import "net/http"

// WithHTTPClient configures the http.Client that should be used.
// If unset or called with nil, http.DefaultClient will be used.
func WithHTTPClient(httpCli *http.Client) Option {
	return func(c *client) error {
		c.httpClient = httpCli
		return nil
	}
}

// WithBearerToken add a bearer Authorization header to each outgoing request.
func WithBearerToken(t string) Option {
	return func(c *client) error {
		c.reqWrappers = append(c.reqWrappers, func(r *http.Request) (*http.Request, error) {
			r.Header.Set("Authorization", "Bearer "+t)
			return r, nil
		})
		return nil
	}
}
