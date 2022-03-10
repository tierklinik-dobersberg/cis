package webhook

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/pkg/tmpl"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

func AddTriggerType(reg *trigger.Registry) error {
	return reg.RegisterType(trigger.ActionType{
		Schema: runtime.Schema{
			Name:        "webhook",
			Description: "Send a Webhook",
			Spec:        Spec,
		},
		CreateFunc: func(ctx context.Context, globalSchema *runtime.ConfigSchema, sec *conf.Section) (trigger.Handler, error) {
			var hook Definition

			if err := conf.DecodeSections([]conf.Section{*sec}, Spec, &hook); err != nil {
				return nil, fmt.Errorf("failed to parse webhook: %w", err)
			}

			tr := &http.Transport{
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
				}).DialContext,
				ForceAttemptHTTP2:     true,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
			}

			if hook.AllowInsecure {
				tr.TLSClientConfig = &tls.Config{
					InsecureSkipVerify: true,
				}
			}

			headers := make(map[string][]string)
			for _, hVal := range hook.Headers {
				parts := strings.SplitN(hVal, "=", 2)
				if len(parts) != 2 {
					return nil, fmt.Errorf("invalid header value %q", hVal)
				}

				headers[parts[0]] = append(headers[parts[0]], parts[1])
			}

			cli := &http.Client{
				Transport: tr,
			}

			return trigger.HandlerFunc(func(ctx context.Context, event ...*event.Event) error {
				errs := new(multierr.Error)

				for _, evt := range event {
					reqCtx := ctx

					if hook.Timeout > 0 {
						var cancel context.CancelFunc
						reqCtx, cancel = context.WithTimeout(reqCtx, hook.Timeout)
						defer cancel()
					}

					body, err := tmpl.Render(ctx, hook.Body, evt)
					if err != nil {
						errs.Addf("failed to render body: %w", err)

						continue
					}

					req, err := http.NewRequestWithContext(reqCtx, hook.Method, hook.Address, strings.NewReader(body))
					if err != nil {
						errs.Addf("failed to create request: %w", err)

						continue
					}

					for hName, hValues := range headers {
						for _, hVal := range hValues {
							req.Header.Add(hName, hVal)
						}
					}

					res, err := cli.Do(req)
					if err != nil {
						errs.Addf("failed to perform request: %w", err)
					} else {
						if res.StatusCode < 200 || res.StatusCode > 299 {
							errs.Addf("got HTTP error code %d: %s", res.StatusCode, res.Status)
						}
					}
				}

				return errs.ToError()
			}), nil
		},
	})
}
