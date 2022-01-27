package main

import (
	"runtime"
	"runtime/debug"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
)

// tracerProvider returns an OpenTelemetry TracerProvider configured to use
// the Jaeger exporter that will send spans to the provided url. The returned
// TracerProvider will also use a Resource configured with all the information
// about the application.
func tracerProvider(cfg *cfgspec.Config) (*tracesdk.TracerProvider, error) {
	b, _ := debug.ReadBuildInfo()
	if b == nil {
		b = new(debug.BuildInfo)
	}

	// Create the Jaeger exporter
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.JaegerTracingURL)))
	if err != nil {
		return nil, err
	}
	tp := tracesdk.NewTracerProvider(
		// Always be sure to batch in production.
		tracesdk.WithBatcher(exp),
		// Record information about this application in a Resource.
		tracesdk.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String(cfg.Service),
			attribute.String("environment", cfg.Environment),
			attribute.String("ID", cfg.ID),
			attribute.String("GOOS", runtime.GOOS),
			attribute.String("main.version", b.Main.Version),
			attribute.String("main.sum", b.Main.Sum),
		)),
	)
	return tp, nil
}
