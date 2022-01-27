package app

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
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

func (r *Router) checkPermission(set permission.Set) echo.MiddlewareFunc {
	return permission.Require(r.app.Matcher, set)
}

func (r *Router) wrap(handler HandlerFunc) echo.HandlerFunc {
	return WrapHandler(r.app, handler)
}

// GET is like echo.Group.GET.
func (r *Router) GET(path string, set permission.Set, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	middlewares = append([]echo.MiddlewareFunc{r.checkPermission(set)}, middlewares...)
	r.r.GET(path, r.wrap(handler), middlewares...)
}

// POST is like echo.Group.POST.
func (r *Router) POST(path string, set permission.Set, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	middlewares = append([]echo.MiddlewareFunc{r.checkPermission(set)}, middlewares...)
	r.r.POST(path, r.wrap(handler), middlewares...)
}

// PUT is like echo.Group.PUT.
func (r *Router) PUT(path string, set permission.Set, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	middlewares = append([]echo.MiddlewareFunc{r.checkPermission(set)}, middlewares...)
	r.r.PUT(path, r.wrap(handler), middlewares...)
}

// PATCH is like echo.Group.PATCH.
func (r *Router) PATCH(path string, set permission.Set, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	middlewares = append([]echo.MiddlewareFunc{r.checkPermission(set)}, middlewares...)
	r.r.PATCH(path, r.wrap(handler), middlewares...)
}

// DELETE is like echo.Group.PATCH.
func (r *Router) DELETE(path string, set permission.Set, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	middlewares = append([]echo.MiddlewareFunc{r.checkPermission(set)}, middlewares...)
	r.r.DELETE(path, r.wrap(handler), middlewares...)
}

// OPTIONS is like echo.Group.OPTIONS.
func (r *Router) OPTIONS(path string, set permission.Set, handler HandlerFunc, middlewares ...echo.MiddlewareFunc) {
	middlewares = append([]echo.MiddlewareFunc{r.checkPermission(set)}, middlewares...)
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
