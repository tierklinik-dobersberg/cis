package cfgspec

import "github.com/ppacher/system-conf/conf"

// IntegrationConfig bundles configuration values required for
// integration with other services
type IntegrationConfig struct {
	RocketChatAddress string
}

// IntegrationConfigSpec defines the configuration stanzas
// for the IntegrationConfig struct.
var IntegrationConfigSpec = conf.SectionSpec{
	{
		Name:        "RocketChatAddress",
		Type:        conf.StringType,
		Description: "Address of the Rocket.Chat webhook used for reporting things.",
	},
}
