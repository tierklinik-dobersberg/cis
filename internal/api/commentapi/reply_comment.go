package commentapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

func ReplyCommentEndpoint(router *app.Router) {
	router.PUT(
		"v1/comment/:id/replies",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			id := c.Param("id")
			if id == "" {
				return httperr.MissingParameter("id")
			}

			sess := session.UserFromCtx(ctx)
			if sess == nil {
				return httperr.InternalError("session missing")
			}

			msg, err := readCommentMessage(c)
			if err != nil {
				return err
			}

			_, err = app.Comments.Reply(ctx, id, sess.User.Id, msg)
			if err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
