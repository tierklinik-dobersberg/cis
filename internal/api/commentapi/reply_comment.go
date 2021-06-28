package commentapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

func ReplyCommentEndpoint(router *app.Router) {
	router.PUT(
		"v1/comment/:id/replies",
		permission.OneOf{
			ReplyCommentsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			id := c.Param("id")
			if id == "" {
				return httperr.MissingParameter("id")
			}

			sess := session.Get(c)
			if sess == nil {
				return httperr.InternalError(nil, "session missing")
			}

			msg, err := readCommentMessage(c)
			if err != nil {
				return err
			}

			_, err = app.Comments.Reply(ctx, id, sess.User.Name, msg)
			if err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}
