package pkglog

import (
	"context"

	"github.com/tierklinik-dobersberg/logger"
)

// PackageLogger is a simple helper type to create named
// package loggers.
type PackageLogger struct {
	Name string
}

// New creates a new logger.
func New(name string) *PackageLogger {
	return &PackageLogger{
		Name: name,
	}
}

// From returns the logger from ctx but with name set to Package logger.
func (log *PackageLogger) From(ctx context.Context) logger.Logger {
	l := logger.From(ctx)
	return l.WithFields(logger.Fields{
		"name": log.Name,
	})
}
