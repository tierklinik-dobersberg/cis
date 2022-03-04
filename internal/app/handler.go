package app

import (
	"context"
	"reflect"
	"runtime"

	"github.com/labstack/echo/v4"
	"go.opentelemetry.io/otel"
)

// HandlerFunc defines a cis HTTP handler func.
type HandlerFunc func(ctx context.Context, app *App, c echo.Context) error

// WrapHandler wraps a handler function into a gin.HandlerFunc.
func WrapHandler(app *App, fn HandlerFunc) echo.HandlerFunc {
	fName := getFunctionName(fn)

	return func(c echo.Context) error {
		ctx := c.Request().Context()
		ctx, sp := otel.Tracer("").Start(ctx, fName)
		defer sp.End()

		return fn(ctx, app, c)
	}
}

func getFunctionName(i interface{}) string {
	return runtime.FuncForPC(reflect.ValueOf(i).Pointer()).Name()
}
