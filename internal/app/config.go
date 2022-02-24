package app

import (
	"github.com/tierklinik-dobersberg/cis/internal/calendar/google"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
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
	session.IdentityConfig    `section:"Global"`
	cfgspec.Config            `section:"Global"`
	cfgspec.DatabaseConfig    `section:"Global"`
	cfgspec.MqttConfig        `section:"Global"`
	cfgspec.VetInf            `section:"Import"`
	cfgspec.InfoScreenConfig  `section:"InfoScreen"`
	cfgspec.IntegrationConfig `section:"Integration"`
	cfgspec.MongoLogConfig    `section:"MongoLog"`
	CORS                      `section:"CORS"`

	CardDAVImports []cfgspec.CardDAVConfig `section:"CardDAV Import"`

	GoogleCalendar google.CalendarConfig `section:"GoogleCalendar"`

	OpeningHours   []openinghours.Definition         `section:"OpeningHour"`
	UserProperties []identity.UserPropertyDefinition `section:"UserProperty"`
	VoiceMails     []cfgspec.VoiceMail               `section:"VoiceMail"`
}
