package app

import (
	"context"

	"github.com/labstack/echo/v4"
)

// HandlerFunc defines a cis HTTP handler func.
type HandlerFunc func(ctx context.Context, app *App, c echo.Context) error

// WrapHandler wraps a handler function into a gin.HandlerFunc.
func WrapHandler(app *App, fn HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		return fn(c.Request().Context(), app, c)
	}
}
