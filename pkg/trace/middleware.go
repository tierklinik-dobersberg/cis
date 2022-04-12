// Package trace implements a OpenTelemetry middleware for labstack/echo.
package trace

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tierklinik-dobersberg/logger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
	"go.opentelemetry.io/otel/trace"
)

const (
	defaultComponentName = "echo/v4"
	defaultBodyLimit     = 1024
)

type Config struct {
	// Skipper defines a function to skip middleware.
	Skipper middleware.Skipper

	// Tracer is the default tracer that should be used.
	// If empty, a new tracer is retrieved using otel.Tracer("")
	Tracer trace.Tracer

	// ComponentName used for describing the tracing component.
	ComponentName string

	// DumpBodies should be set to true if the request and response
	// bodies should be dumped to spans.
	DumpBodies bool

	// LimitBodySize holds the maximum number of bytes that are appended to
	// a span.
	LimitBodySize int
}

var DefaultConfig = Config{
	Skipper:       middleware.DefaultSkipper,
	ComponentName: defaultComponentName,
	DumpBodies:    false,
	LimitBodySize: defaultBodyLimit,
}

func RecordAndLog(ctx context.Context, err error, keyVals ...string) {
	sp := trace.SpanFromContext(ctx)

	if err != nil {
		sp.RecordError(err)
	}

	var attributes []attribute.KeyValue
	var fields = make(logger.Fields)
	for i := 0; i < len(keyVals); i += 2 {
		key := keyVals[i]

		value := ""
		if len(keyVals) < i+1 {
			value = keyVals[i+1]
		}

		attributes = append(attributes, attribute.String(key, value))
		fields[key] = value
	}

	sp.SetAttributes(attributes...)

	if err != nil {
		logger.From(ctx).WithFields(fields).Errorf(err.Error())
	}
}

// Record adds an error to the current span and appends keyVal as attributes.
func Record(ctx context.Context, err error, keyVals ...string) {
	sp := trace.SpanFromContext(ctx)

	if err != nil {
		sp.RecordError(err)
	}

	var attributes []attribute.KeyValue
	for i := 0; i < len(keyVals); i += 2 {
		key := keyVals[i]

		value := ""
		if len(keyVals) < i+1 {
			value = keyVals[i+1]
		}

		attributes = append(attributes, attribute.String(key, value))
	}

	sp.SetAttributes(attributes...)
}

// trunk-ignore(golangci-lint/cyclop)
func WithConfig(config Config) echo.MiddlewareFunc {
	if config.Tracer == nil {
		config.Tracer = otel.Tracer("")
	}
	if config.Skipper == nil {
		config.Skipper = middleware.DefaultSkipper
	}
	if config.DumpBodies && config.LimitBodySize == 0 {
		config.LimitBodySize = defaultBodyLimit
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {
			if config.Skipper(c) {
				return next(c)
			}

			req := c.Request()
			opname := fmt.Sprintf("HTTP %s URL: %s", req.Method, c.Path())
			requestID := getRequestID(c)

			attrs := []attribute.KeyValue{
				attribute.String("http.request_id", requestID),
				semconv.NetPeerIPKey.String(c.RealIP()),
				semconv.HTTPMethodKey.String(req.Method),
				semconv.HTTPTargetKey.String(req.RequestURI),
				semconv.HTTPRequestContentLengthKey.Int64(req.ContentLength),
				semconv.HTTPRouteKey.String(c.Path()),
			}
			attrs = append(attrs, semconv.HTTPClientAttributesFromHTTPRequest(req)...)

			// TODO(ppacher): only allow in a debug build
			if specName := req.Header.Get("X-Spec-Name"); specName != "" {
				attrs = append(attrs, attribute.String("spec.name", specName))
			}
			if specID := req.Header.Get("X-Spec-ID"); specID != "" {
				attrs = append(attrs, attribute.String("spec.id", specID))
			}

			// add all path parameters
			for _, name := range c.ParamNames() {
				attrs = append(attrs, attribute.String(
					fmt.Sprintf("http.path_param.%s", name),
					c.Param(name),
				))
			}

			// add all path parameters
			for key, value := range c.QueryParams() {
				attrs = append(attrs, attribute.StringSlice(
					fmt.Sprintf("http.query_param.%s", key),
					value,
				))
			}

			ctx, span := config.Tracer.Start(req.Context(), opname, trace.WithAttributes(attrs...))
			defer span.End()

			// TODO(ppacher): dump request

			req = req.WithContext(ctx)
			c.SetRequest(req)

			defer func() {
				if x := recover(); x != nil {
					err, ok := x.(error)
					if !ok {
						err = fmt.Errorf("%+v", x)
					}

					span.RecordError(err, trace.WithStackTrace(true))
					span.SetStatus(codes.Error, err.Error())

					if !c.Response().Committed {
						returnErr = c.NoContent(http.StatusInternalServerError)
					}
				}
			}()

			returnErr = next(c)
			if returnErr != nil {
				c.Error(returnErr)
				logger.From(ctx).Errorf("%s, %+v", returnErr.Error(), returnErr)
				span.RecordError(returnErr)
				span.SetStatus(codes.Error, returnErr.Error())
			}

			span.SetAttributes(
				semconv.HTTPStatusCodeKey.Int(c.Response().Status),
				semconv.HTTPResponseContentLengthKey.Int64(c.Response().Size),
			)

			return returnErr
		}
	}
}

func getRequestID(ctx echo.Context) string {
	requestID := ctx.Request().Header.Get(echo.HeaderXRequestID) // request-id generated by reverse-proxy
	if requestID == "" {
		requestID = generateToken() // missed request-id from proxy, we generate it manually
	}

	return requestID
}

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)

	return fmt.Sprintf("%x", b)
}
