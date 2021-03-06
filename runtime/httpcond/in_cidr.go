package httpcond

import (
	"net"
	"net/http"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/service/utils"
)

func init() {
	MustRegister(Type{
		Name:        "RequestFromCIDR",
		Description: "Matches requests that originate from the given CIDR addresses",
		Type:        conf.StringSliceType,
		ConcatFunc:  NewOr,
		Match: func(req *http.Request, value string) (bool, error) {
			_, network, err := net.ParseCIDR(value)
			if err != nil {
				return false, err
			}

			ip := utils.RealClientIP(req)
			if ip == nil {
				log.From(req.Context()).Errorf("RequestFromCIDR: failed to get (real) client IP")
				return false, nil
			}

			return network.Contains(ip), nil
		},
	})
}
