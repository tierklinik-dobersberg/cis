package app

import (
	"github.com/tierklinik-dobersberg/cis/internal/calendar/google"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
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
}
