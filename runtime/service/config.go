package service

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
)

// Config describes the overall configuration and setup required
// to boot the system service.
type Config struct {
	// AccessLogPath is the path to the access log of the
	// built-in HTTP server. If defined as "AccessLogPath"
	// by ConfigSchema, the access log may be overwritten
	// by the configuration file automatically.
	AccessLogPath string

	// ConfigFileName is the name of the configuration file.
	// The extension of the configuration file defaults
	// to .conf.
	ConfigFileName string

	// EnvironmentPrefix holds the prefix that is used for environment variables
	// that should be applied to the configuration.
	EnvironmentPrefix string

	// ConfigDirectory is the name of the directory that may contain
	// separate configuration files.
	ConfigDirectory string

	// UseStdlibLogAdapter can be set to true to immediately add a new
	// logger.StandardAdapter to the service logger.
	UseStdlibLogAdapter bool

	// LogLevel can be set to the default log level. This can later be
	// overwritten by using instance.SetLogLevel().
	LogLevel logger.Severity

	// ConfigSchema describes the allowed sections and
	// values of the configuration file. Note that if
	// DisableServer is not set the schema is extended
	// to include Listener sections for the built-in HTTP(s)
	// server.
	// If no [Listener] section is defined and the built-in
	// HTTP server is enabled a default listener for
	// 127.0.0.1:3000 is created.
	ConfigSchema conf.SectionRegistry

	// ConfigTarget may holds the struct that should be
	// used to unmarshal the configuration file into.
	ConfigTarget interface{}

	// DisableCORS disables automatic support for CORS
	// configuration using the global configuration file.
	DisableCORS bool
}

func (cfg *Config) OptionsForSection(secName string) (conf.OptionRegistry, bool) {
	if cfg.ConfigSchema != nil {
		return cfg.ConfigSchema.OptionsForSection(secName)
	}
	return nil, false
}
