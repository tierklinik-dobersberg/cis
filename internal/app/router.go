package app

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// Router wraps a gin router interface to use HandlerFunc
// instead of gin.HandlerFunc.
type Router struct {
	r gin.IRouter
}

// NewRouter returns a new application router wrapping r.
func NewRouter(r gin.IRouter) *Router {
	return &Router{r}
}

func (r *Router) checkPermission(set permission.Set) gin.HandlerFunc {
	return func(c *gin.Context) {
		app := From(c)
		if app == nil {
			httperr.InternalError(nil, "missing app").AbortRequest(c)
			return
		}

		permission.Require(app.Matcher, set)(c)
	}
}

// GET is like gin.IRouter.GET.
func (r *Router) GET(path string, set permission.Set, handler HandlerFunc) {
	r.r.GET(path, r.checkPermission(set), WrapHandler(handler))
}

// POST is like gin.IRouter.POST.
func (r *Router) POST(path string, set permission.Set, handler HandlerFunc) {
	r.r.POST(path, r.checkPermission(set), WrapHandler(handler))
}

// PUT is like gin.IRouter.PUT.
func (r *Router) PUT(path string, set permission.Set, handler HandlerFunc) {
	r.r.PUT(path, r.checkPermission(set), WrapHandler(handler))
}

// PATCH is like gin.IRouter.PATCH.
func (r *Router) PATCH(path string, set permission.Set, handler HandlerFunc) {
	r.r.PATCH(path, r.checkPermission(set), WrapHandler(handler))
}

// DELETE is like gin.IRouter.PATCH.
func (r *Router) DELETE(path string, set permission.Set, handler HandlerFunc) {
	r.r.DELETE(path, r.checkPermission(set), WrapHandler(handler))
}

// OPTIONS is like gin.IRouter.OPTIONS.
func (r *Router) OPTIONS(path string, set permission.Set, handler HandlerFunc) {
	r.r.OPTIONS(path, r.checkPermission(set), WrapHandler(handler))
}

// Group returns a new router that groups handlers at path.
// It works like gin.IRouter.Group.
func (r *Router) Group(path string, handlers ...gin.HandlerFunc) *Router {
	return &Router{
		r: r.r.Group(path, handlers...),
	}
}
