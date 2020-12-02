package schema

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/internal/crypt"
)

type GlobalConfig struct {
	Secret          string
	CookieName      string
	CookieDomain    string
	InsecureCookies bool
	AccessLogFile   string
}

// GlobalConfigSpec defines the available configuration values for the
// [Global] configuration section.
var GlobalConfigSpec = []conf.OptionSpec{
	{
		Name:        "Secret",
		Description: "Secret used to sign session cookies. If empty, a temporary secret is created.",
		Type:        conf.StringType,
	},
	{
		Name:        "CookieName",
		Default:     "userhub",
		Description: "Name of the session cookie",
		Type:        conf.StringType,
	},
	{
		Name:        "CookieDomain",
		Required:    true,
		Description: "The domain for which session cookies should be created",
		Type:        conf.StringType,
	},
	{
		Name:        "InsecureCookies",
		Default:     "no",
		Description: "Wether or not the session cookie should be HTTPS only",
		Type:        conf.BoolType,
	},
	{
		Name:        "AccessLogFile",
		Description: "Path to access lo file",
		Type:        conf.StringType,
	},
}

// BuildGlobalConfig builds a global configuration from the specified
// section.
func BuildGlobalConfig(sec conf.Section) (GlobalConfig, error) {
	cfg := GlobalConfig{}

	var err error
	cfg.CookieName, err = sec.GetString("CookieName")
	if err != nil {
		return cfg, fmt.Errorf("CookieName: %w", err)
	}

	cfg.Secret, err = sec.GetString("Secret")
	if conf.IsNotSet(err) {
		cfg.Secret, err = crypt.Nonce(32)
	}
	if err != nil {
		return cfg, fmt.Errorf("Secret: %w", err)
	}

	cfg.CookieDomain, err = sec.GetString("CookieDomain")
	if err != nil {
		return cfg, fmt.Errorf("CookieDomain: %w", err)
	}

	cfg.InsecureCookies, err = sec.GetBool("InsecureCookies")
	if err != nil {
		return cfg, fmt.Errorf("InsecureCookies: %w", err)
	}

	cfg.AccessLogFile, err = getOptionalString(sec, "AccessLogFile")
	if err != nil {
		return cfg, fmt.Errorf("AccessLogFile: %w", err)
	}

	return cfg, nil
}
