package httpcond

import (
	"encoding/base64"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
)

// trunk-ignore(golangci-lint/cyclop)
func init() {
	MustRegister(Type{
		Name:        "AccessToken",
		Description: "Matches requests that have access token set to one of the values. Supported methods are Authorization Bearer, access_token form field or query parameter. RFC6750",
		ConcatFunc:  NewOr,
		Type:        conf.StringSliceType,
		Match: func(c echo.Context, value string) (bool, error) {
			req := c.Request()
			log := log.From(req.Context())
			var token string
			// trunk-ignore(golangci-lint/nestif)
			if authHeader := req.Header.Get("Authorization"); authHeader != "" {
				switch {
				case strings.HasPrefix(authHeader, "Bearer "):
					token = strings.TrimPrefix(authHeader, "Bearer ")
				case strings.HasPrefix(authHeader, "Basic "):
					tokenValue := strings.TrimPrefix(authHeader, "Basic ")
					tokenBlob, err := base64.URLEncoding.DecodeString(tokenValue)
					if err != nil {
						// do not report this as an error here
						log.Infof("Found Basic authorization header but failed to base64 decode it: %q: %s", value, err)

						return false, nil
					}

					token = string(tokenBlob)

					// if the basic value contains a ":" we might need to split username / password
					// apart and ignore one of them.
					if strings.Contains(token, ":") {
						parts := strings.SplitN(token, ":", 2)
						log.Infof("Testing access token %q against %q", parts[0], value)
						if parts[0] == value {
							log.Infof("Accepting access token in user part")

							return true, nil
						}

						log.Infof("Testing access token %q against %q", parts[1], value)
						if parts[1] == value {
							log.Infof("Accepting access token in password part")

							return true, nil
						}
					}
				default:
					return false, nil
				}
			} else if h := req.URL.Query().Get("access_token"); h != "" {
				token = h
			} else if h := req.Header.Get("Content-Type"); strings.Contains(h, "application/x-www-form-urlencoded") {
				if err := req.ParseForm(); err != nil {
					return false, err
				}

				token = req.Form.Get("access_token")
			}

			// no access token found so return immediately. Testing against an empty
			// value is not supported as it will match basically all requests.
			if token == "" {
				return false, nil
			}

			log.Infof("Testing access token %q against %q", token, value)

			return token == value, nil
		},
	})
}
