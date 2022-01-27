package commentapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup configures all commentapi routes.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/comments/v1/:key
	LoadCommentsForKeyEndpoint(router)

	// POST /api/comments/v1/:key
	CreateCommentEndpoint(router)

	// PUT /api/comments/v1/comment/:id/replies
	ReplyCommentEndpoint(router)
}
