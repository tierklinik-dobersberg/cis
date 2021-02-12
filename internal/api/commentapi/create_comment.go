package commentapi

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/session"
)

func CreateCommentEndpoint(router *app.Router) {
	router.POST(
		"v1/:key",
		permission.Set{
			CreateCommentAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			key := c.Param("key")
			if key == "" {
				return httperr.MissingParameter("key")
			}

			sess := session.Get(c)
			if sess == nil {
				return httperr.InternalError(nil, "session missing")
			}

			var msg string

			contentType := c.Request.Header.Get("Content-Type")
			switch {
			case strings.Contains(contentType, "application/json"):
				if err := json.NewDecoder(c.Request.Body).Decode(&msg); err != nil {
					return httperr.BadRequest(err)
				}

			case strings.Contains(contentType, "text/plain"):
				blob, err := ioutil.ReadAll(c.Request.Body)
				if err != nil {
					return httperr.InternalError(err, "incomplete read")
				}

				msg = string(blob)

			default:
				return httperr.BadRequest(nil, "unsupported content type: "+contentType)
			}

			_, err := app.Comments.Create(ctx, key, sess.User.Name, msg)
			if err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}
