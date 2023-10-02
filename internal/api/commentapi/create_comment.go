package commentapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

func CreateCommentEndpoint(router *app.Router) {
	router.POST(
		"v1/:key",
		permission.OneOf{
			CreateCommentAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			key := c.Param("key")
			if key == "" {
				return httperr.MissingParameter("key")
			}

			sess := session.UserFromCtx(ctx)
			if sess == nil {
				return httperr.InternalError("session missing")
			}

			msg, err := readCommentMessage(c)
			if err != nil {
				return err
			}

			_, err = app.Comments.Create(ctx, key, sess.User.Id, msg)
			if err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
