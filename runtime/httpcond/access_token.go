package httpcond

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/ppacher/system-conf/conf"
)

func init() {
	MustRegister(Type{
		Name:        "AccessToken",
		Description: "Matches requests that have access token set to one of the values. Supported methods are Authorization Bearer, access_token form field or query parameter. RFC6750",
		ConcatFunc:  NewOr,
		Type:        conf.StringSliceType,
		Match: func(r *http.Request, value string) (bool, error) {
			log := log.From(r.Context())
			var token string
			if h := r.Header.Get("Authorization"); h != "" {
				switch {
				case strings.HasPrefix(h, "Bearer "):
					token = strings.TrimPrefix(h, "Bearer ")
				case strings.HasPrefix(h, "Basic "):
					tokenValue := strings.TrimPrefix(h, "Basic ")
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
			} else if h := r.URL.Query().Get("access_token"); h != "" {
				token = h
			} else if h := r.Header.Get("Content-Type"); strings.Contains(h, "application/x-www-form-urlencoded") {
				if err := r.ParseForm(); err != nil {
					return false, err
				}

				token = r.Form.Get("access_token")
			}

			log.Infof("Testing access token %q against %q", token, value)
			return token == value, nil
		},
	})
}
