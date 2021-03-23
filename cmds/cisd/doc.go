package main

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/service/server"
)

var globalConfigFile = autodoc.MustRegister(autodoc.File{
	Name:        "cis.conf",
	Description: "The main configuration file for CIS.",
	Sections: conf.FileSpec{
		"Global": autodoc.MergeOptions(
			schema.ConfigSpec,
			schema.DatabaseSpec,
			schema.IdentityConfigSpec,
			schema.MqttSpec,
		),
		"Import":       schema.VetInfSpec,
		"Listener":     server.ListenerSpec,
		"UserProperty": schema.UserSchemaExtension,
		"OpeningHour":  schema.OpeningHoursSpec,
		"Integration":  schema.IntegrationConfigSpec,
		"Voicemail":    schema.VoiceMailSpec,
	},
})
