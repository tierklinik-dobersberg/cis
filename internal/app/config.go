package app

import (
	"github.com/tierklinik-dobersberg/cis/internal/calendar"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// Config holds the complete cisd configuration.
type Config struct {
	session.IdentityConfig `section:"Global"`
	cfgspec.Config         `section:"Global"`
	cfgspec.DatabaseConfig `section:"Global"`
	cfgspec.MqttConfig     `section:"Global"`
	cfgspec.VetInf         `section:"Import"`

	cfgspec.IntegrationConfig `section:"Integration"`

	cfgspec.MongoLogConfig `section:"MongoLog"`

	GoogleCalendar calendar.GoogleCalendarConfig `section:"GoogleCalendar"`

	OpeningHours   []cfgspec.OpeningHours           `section:"OpeningHour"`
	UserProperties []cfgspec.UserPropertyDefinition `section:"UserProperty"`
	VoiceMails     []cfgspec.VoiceMail              `section:"VoiceMail"`

	UI UIConfig `section:"-"`
}

// UIConfig holds the configuration that is soley important for the
// user interface.
type UIConfig struct {
	cfgspec.UI `section:"UI"`

	ExternalLinks         []cfgspec.ExternalLink         `section:"ExternalLink"`
	QuickRosterOverwrites []cfgspec.QuickRosterOverwrite `section:"QuickRosterOverwrite"`
	KnownPhoneExtensions  []cfgspec.KnownPhoneExtension  `section:"KnownPhoneExtension"`
	TriggerActions        []cfgspec.TriggerAction        `section:"TriggerAction"`
}
