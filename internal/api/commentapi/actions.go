package commentapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

var (
	// CreateCommentAction defines the action that must be permitted to create
	// new comments under a certain key.
	CreateCommentAction = permission.MustDefineAction(
		"comment:create",
		"Permssion required to create new comments at a given key",
		func(c *gin.Context) (string, error) {
			key := c.Param("key")
			if key == "" {
				return "", httperr.MissingParameter("key")
			}

			return key, nil
		},
	)

	// ReadCommentsAction defines the action that must be permitted to read
	// comments stored under a certain key.
	ReadCommentsAction = permission.MustDefineAction(
		"comment:read",
		"Permission required to read comments at a given key",
		func(c *gin.Context) (string, error) {
			key := c.Param("key")
			if key == "" {
				return "", httperr.MissingParameter("key")
			}

			return key, nil
		},
	)

	// ReplyCommentsAction is the action required to reply to comments
	// under a certain key.
	ReplyCommentsAction = permission.MustDefineAction(
		"comment:reply",
		"permission required to replay to a comment",
		func(c *gin.Context) (string, error) {
			app := app.From(c)
			if app == nil {
				return "", httperr.InternalError(nil, "app is nil")
			}

			id := c.Param("id")
			if id == "" {
				return "", httperr.MissingParameter("id")
			}

			parent, err := app.Comments.ByID(c.Request.Context(), id)
			if err != nil {
				return "", err
			}

			return parent.Key, nil
		},
	)
)
