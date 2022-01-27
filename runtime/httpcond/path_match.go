package httpcond

import (
	"regexp"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
)

func init() {
	MustRegister(Type{
		Name:        "PathMatch",
		Description: "Matches against the resource path. Accepts a golang regular expression. See regexp.Compile",
		ConcatFunc:  NewOr,
		Type:        conf.StringSliceType,
		Match: func(c echo.Context, value string) (bool, error) {
			req := c.Request()
			re, err := regexp.Compile(value)
			if err != nil {
				return false, err
			}

			if re.MatchString(req.URL.Path) {
				return true, nil
			}

			return false, nil
		},
	})
}
