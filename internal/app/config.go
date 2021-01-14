package app

import (
	"github.com/ppacher/system-conf/conf"
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

	OpeningHours   []schema.OpeningHours `section:"OpeningHour"`
	UserProperties []conf.OptionSpec     `section:"UserProperty"`
	Listeners      []server.Listener     `section:"Listener"`

	UI UIConfig `section:"-"`
}

type UIConfig struct {
	schema.UI `section:"UI"`

	ExternalLinks []schema.ExternalLink `section:"ExternalLink"`
}
