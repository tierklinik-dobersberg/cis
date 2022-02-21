package session

import (
	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
)

func init() {
	httpcond.MustRegister(httpcond.Type{
		Name:        "SessionUser",
		Description: "Match against the session user.",
		Type:        conf.StringSliceType,
		ConcatFunc:  httpcond.NewOr,
		Match: func(c echo.Context, value string) (bool, error) {
			req := c.Request()
			sess := FromCtx(req.Context())
			if sess == nil {
				return false, nil
			}

			if sess.User.Name == value {
				return true, nil
			}

			return false, nil
		},
	})

	httpcond.MustRegister(httpcond.Type{
		Name:        "SessionRole",
		Description: "Match against the available session roles.",
		Type:        conf.StringSliceType,
		ConcatFunc:  httpcond.NewAnd,
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRoles,
		),
		Match: func(c echo.Context, value string) (bool, error) {
			req := c.Request()
			sess := FromCtx(req.Context())
			if sess == nil {
				return false, nil
			}

			for _, role := range sess.DistinctRoles() {
				if role == value {
					return true, nil
				}
			}

			return false, nil
		},
	})
}
