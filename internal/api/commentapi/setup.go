package commentapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures all commentapi routes.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/comments/v1/:key
	LoadCommentsForKeyEndpoint(router)

	// POST /api/comments/v1/:key
	CreateCommentEndpoint(router)

	// PUT /api/comments/v1/comment/:id/replies
	ReplyCommentEndpoint(router)
}
