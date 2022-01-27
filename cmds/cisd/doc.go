package main

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/calendar/google"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/autodoc"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/runtime/autologin"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
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
		"Global": confutil.MultiOptionRegistry{
			cfgspec.ConfigSpec,
			cfgspec.DatabaseSpec,
			session.IdentityConfigSpec,
			cfgspec.MqttSpec,
		},
		"InfoScreen":     cfgspec.InfoScreenConfigSpec,
		"Import":         cfgspec.VetInfSpec,
		"UserProperty":   cfgspec.UserSchemaExtension,
		"OpeningHour":    cfgspec.OpeningHoursSpec,
		"Integration":    cfgspec.IntegrationConfigSpec,
		"Voicemail":      cfgspec.VoiceMailSpec,
		"MongoLog":       cfgspec.MongoLogSpec,
		"GoogleCalendar": google.GoogleConfigSpec,
		"CardDAV Import": cfgspec.CardDAVSpec,
		"CORS":           server.CORSSpec,
		"Autologin":      autologin.Spec(httpcond.DefaultRegistry),
	},
})

var uiConfigFile = autodoc.MustRegister(autodoc.File{
	Name:        "ui.conf",
	Description: "Configuration file for the User-Interface.",
	LookupPaths: []string{
		svcenv.Env().ConfigurationDirectory,
	},
	Sections: conf.FileSpec{
		"UI":                   cfgspec.UISpec,
		"ExternalLink":         cfgspec.ExternalLinkSpec,
		"QuickRosterOverwrite": cfgspec.QuickRosterOverwriteSpec,
		"KnownPhoneExtension":  cfgspec.KnownPhoneExtensionSpec,
		"TriggerAction":        cfgspec.TriggerActionSpec,
		"Roster":               cfgspec.RosterUISpec,
	},
})
