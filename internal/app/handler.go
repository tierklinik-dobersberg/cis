package app

import (
	"context"

	"github.com/gin-gonic/gin"
)

// HandlerFunc defines a cis HTTP handler func.
type HandlerFunc func(ctx context.Context, app *App, c *gin.Context) error

// WrapHandler wraps a handler function into a gin.HandlerFunc.
func WrapHandler(fn HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		app := From(c)
		if app == nil {
			return
		}

		err := fn(c.Request.Context(), app, c)
		if err != nil {
			c.Error(err)
			//httperr.MaybeAbort(c)
		}
	}
}
