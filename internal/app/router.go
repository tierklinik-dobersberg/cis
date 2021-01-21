package app

import "github.com/gin-gonic/gin"

// Router wraps a gin router interface to use HandlerFunc
// instead of gin.HandlerFunc
type Router struct {
	r gin.IRouter
}

// NewRouter returns a new application router wrapping r.
func NewRouter(r gin.IRouter) *Router {
	return &Router{r}
}

// GET is like gin.IRouter.GET
func (r *Router) GET(path string, handler HandlerFunc) {
	r.r.GET(path, WrapHandler(handler))
}

// POST is like gin.IRouter.POST
func (r *Router) POST(path string, handler HandlerFunc) {
	r.r.POST(path, WrapHandler(handler))
}

// PUT is like gin.IRouter.PUT
func (r *Router) PUT(path string, handler HandlerFunc) {
	r.r.PUT(path, WrapHandler(handler))
}

// PATCH is like gin.IRouter.PATCH
func (r *Router) PATCH(path string, handler HandlerFunc) {
	r.r.PATCH(path, WrapHandler(handler))
}

// DELETE is like gin.IRouter.PATCH
func (r *Router) DELETE(path string, handler HandlerFunc) {
	r.r.DELETE(path, WrapHandler(handler))
}

// OPTIONS is like gin.IRouter.OPTIONS
func (r *Router) OPTIONS(path string, handler HandlerFunc) {
	r.r.OPTIONS(path, WrapHandler(handler))
}

// Group returns a new router that groups handlers at path.
// It works like gin.IRouter.Group
func (r *Router) Group(path string, handlers ...gin.HandlerFunc) *Router {
	return &Router{
		r: r.r.Group(path, handlers...),
	}
}
