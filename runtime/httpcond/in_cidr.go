package httpcond

import (
	"net"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
)

func init() {
	MustRegister(Type{
		Name:        "RequestFromCIDR",
		Description: "Matches requests that originate from the given CIDR addresses",
		Type:        conf.StringSliceType,
		ConcatFunc:  NewOr,
		Match: func(c echo.Context, value string) (bool, error) {
			_, network, err := net.ParseCIDR(value)
			if err != nil {
				return false, err
			}

			ip := net.ParseIP(c.RealIP())
			if ip == nil {
				log.From(c.Request().Context()).Errorf("RequestFromCIDR: failed to get (real) client IP")
				return false, nil
			}

			return network.Contains(ip), nil
		},
	})
}
