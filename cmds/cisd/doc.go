package main

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/svcenv"
)

var globalConfigFile = autodoc.MustRegister(autodoc.File{
	Name:        "cis.conf",
	Description: "The main configuration file for CIS.",
	LookupPaths: []string{
		svcenv.Env().ConfigurationDirectory,
	},
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
		"MongoLog":     schema.MongoLogSpec,
		"CORS":         server.CORSSpec,
	},
})

var uiConfigFile = autodoc.MustRegister(autodoc.File{
	Name:        "ui.conf",
	Description: "Configuration file for the User-Interface.",
	LookupPaths: []string{
		svcenv.Env().ConfigurationDirectory,
	},
	Sections: conf.FileSpec{
		"UI":                   schema.UISpec,
		"ExternalLink":         schema.ExternalLinkSpec,
		"QuickRosterOverwrite": schema.QuickRosterOverwriteSpec,
		"KnownPhoneExtension":  schema.KnownPhoneExtensionSpec,
	},
})
