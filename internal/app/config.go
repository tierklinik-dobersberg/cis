package app

import (
	"context"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/calendar/google"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
)

// CORS is a type-alias to cors.Config to avoid additional
// imports in client packages.
type CORS struct {
	AllowAllOrigins        bool
	AllowOrigins           []string
	AllowMethods           []string
	AllowHeaders           []string
	AllowCredentials       bool
	ExposeHeaders          []string
	MaxAge                 string
	AllowWildcard          bool
	AllowBrowserExtensions bool
	AllowWebSockets        bool
}

// Config holds the complete cisd configuration.
type Config struct {
	session.IdentityConfig   `section:"Global"`
	cfgspec.Config           `section:"Global"`
	cfgspec.DatabaseConfig   `section:"Global"`
	cfgspec.InfoScreenConfig `section:"InfoScreen"`
	CORS                     `section:"CORS"`

	GoogleCalendar google.CalendarConfig `section:"GoogleCalendar"`

	// FIXME(ppacher): unexported members should actually be ingored
	loadLocationOnce sync.Once      `section:"-"`
	location         *time.Location `section:"-"`
}

func (cfg *Config) Location() *time.Location {
	cfg.loadLocationOnce.Do(func() {
		loc, err := time.LoadLocation(cfg.TimeZone)
		if err != nil {
			logger.Errorf(context.Background(), "failed to parse location: %s (%w). using time.Local instead", cfg.TimeZone, err)
			loc = time.Local
		}
		cfg.location = loc
		if cfg.location.String() != time.Local.String() {
			// warn for now if there's a difference. We should have all times fixed already
			// but better make sure the user knowns.
			logger.Errorf(context.Background(), "WARNING: local time zone and configured TimeZone= differ. It's recommended to keep them the same!")
		}
	})

	return cfg.location
}
