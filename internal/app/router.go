package app

import (
	"github.com/labstack/echo/v4"
)

// Router wraps a gin router interface to use HandlerFunc
// instead of gin.HandlerFunc.
type Router struct {
	app *App
	r   *echo.Group
}

// NewRouter returns a new application router wrapping r.
func NewRouter(r *echo.Group, app *App) *Router {
	return &Router{
		r:   r,
		app: app,
	}
}

func (r *Router) wrap(handler HandlerFunc) echo.HandlerFunc {
	return WrapHandler(r.app, handler)
}

// GET is like echo.Group.GET.
func (r *Router) GET(path string, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	r.r.GET(path, r.wrap(handler), middlewares...)
}

// POST is like echo.Group.POST.
func (r *Router) POST(path string, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	r.r.POST(path, r.wrap(handler), middlewares...)
}

// PUT is like echo.Group.PUT.
func (r *Router) PUT(path string, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	r.r.PUT(path, r.wrap(handler), middlewares...)
}

// PATCH is like echo.Group.PATCH.
func (r *Router) PATCH(path string, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	r.r.PATCH(path, r.wrap(handler), middlewares...)
}

// DELETE is like echo.Group.PATCH.
func (r *Router) DELETE(path string, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	r.r.DELETE(path, r.wrap(handler), middlewares...)
}

// OPTIONS is like echo.Group.OPTIONS.
func (r *Router) OPTIONS(path string, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	r.r.OPTIONS(path, r.wrap(handler), middlewares...)
}

// Group returns a new router that groups handlers at path.
// It works like echo.Group.Group.
func (r *Router) Group(path string, handlers ...echo.MiddlewareFunc) *Router {
	return &Router{
		r:   r.r.Group(path, handlers...),
		app: r.app,
	}
}
