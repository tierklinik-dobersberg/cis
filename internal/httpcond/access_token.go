package httpcond

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
)

func init() {
	MustRegister(Type{
		Name:        "AccessToken",
		Description: "Matches requests that have access token set to one of the values. Supported methods are Authorization Bearer, access_token form field or query parameter. RFC6750",
		ConcatFunc:  NewOr,
		Type:        conf.StringSliceType,
		Match: func(r *http.Request, value string) (bool, error) {
			var token string
			if h := r.Header.Get("Authorization"); h != "" {
				switch {
				case strings.HasPrefix(h, "Bearer "):
					token = strings.TrimPrefix(h, "Bearer ")
				case strings.HasPrefix(h, "Basic "):
					value := strings.TrimPrefix(h, "Basic ")
					tokenBlob, err := base64.URLEncoding.DecodeString(value)
					if err != nil {
						// do not report this as an error here
						logger.Infof(r.Context(), "Found Basic authorization header but failed to base64 decode it: %q: %s", value, err)
						return false, nil
					}

					token = string(tokenBlob)
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

			return token == value, nil
		},
	})
}
