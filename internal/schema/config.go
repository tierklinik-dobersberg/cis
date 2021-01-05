package schema

import (
	"time"

	"github.com/ppacher/system-conf/conf"
)

// Config groups global configuration values that are used by various subsystems
// of cisd.
type Config struct {
	Secret            string
	Country           string
	AccessLogFile     string
	DefaultOpenBefore time.Duration
	DefaultCloseAfter time.Duration
}

// ConfigSpec defines the different configuration stanzas for the Config struct.
var ConfigSpec = conf.SectionSpec{
	{
		Name:        "Secret",
		Description: "Secret used to sign various data like session cookies. If empty, a temporary secret is created.",
		Type:        conf.StringType,
	},
	{
		Name:        "Country",
		Description: "The country cisd operates in",
		Default:     "AT",
		Type:        conf.StringType,
	},
	{
		Name:        "AccessLogFile",
		Description: "Path to access lo file",
		Type:        conf.StringType,
	},
	{
		Name:        "DefaultOpenBefore",
		Type:        conf.DurationType,
		Description: "Default value for OpenBefore= in [OpeningHour]",
	},
	{
		Name:        "DefaultCloseAfter",
		Type:        conf.DurationType,
		Description: "Default value for CloseAfter= in [OpeningHour]",
	},
}
