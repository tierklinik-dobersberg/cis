package app

import (
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/service/server"
)

// Config holds the complete cisd configuration.
type Config struct {
	schema.IdentityConfig `section:"Global"`
	schema.Config         `section:"Global"`
	schema.DatabaseConfig `section:"Global"`
	schema.MqttConfig     `section:"Global"`
	schema.VetInf         `section:"Import"`

	schema.IntegrationConfig `section:"Integration"`

	OpeningHours   []schema.OpeningHours           `section:"OpeningHour"`
	UserProperties []schema.UserPropertyDefinition `section:"UserProperty"`
	Listeners      []server.Listener               `section:"Listener"`
	VoiceMails     []schema.VoiceMail              `section:"VoiceMail"`

	UI UIConfig `section:"-"`
}

// UIConfig holds the configuration that is soley important for the
// user interface.
type UIConfig struct {
	schema.UI `section:"UI"`

	ExternalLinks         []schema.ExternalLink         `section:"ExternalLink"`
	QuickRosterOverwrites []schema.QuickRosterOverwrite `section:"QuickRosterOverwrite"`
}
