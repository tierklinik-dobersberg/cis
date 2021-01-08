package httpcond

import (
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
			var token string
			if h := r.Header.Get("Authorization"); h != "" {
				if !strings.HasPrefix(h, "Bearer ") {
					return false, nil
				}
				token = strings.TrimPrefix(h, "Bearer ")
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
