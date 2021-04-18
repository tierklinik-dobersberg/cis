package cfgspec

import (
	"time"

	"github.com/ppacher/system-conf/conf"
)

// Config groups global configuration values that are used by various subsystems
// of cisd.
type Config struct {
	Secret        string
	Issuer        string
	BaseURL       string
	Audience      string
	SigningMethod string // TODO(ppacher): add support for asymetric crypto and key-rotation!
	Country       string
	AccessLogFile string
	TimeZone      string

	UnknownContactName   string
	UnknownContactSource string
	UnknownContactID     int

	DefaultOpenBefore   time.Duration
	DefaultCloseAfter   time.Duration
	DefaultChangeOnDuty string
}

// ConfigSpec defines the different configuration stanzas for the Config struct.
var ConfigSpec = conf.SectionSpec{
	{
		Name:        "Secret",
		Description: "Secret used to sign various data like session cookies and JWTs. If empty, a temporary secret is created.",
		Type:        conf.StringType,
	},
	{
		Name:        "BaseURL",
		Description: "The base URL on which CIS is reachable. If empty, it defaults to the Host header of each HTTP request.",
		Type:        conf.StringType,
	},
	{
		Name:        "Issuer",
		Description: "The issuer value to use for JWT tokens",
		Type:        conf.StringType,
		Default:     "cisd",
	},
	{
		Name:        "SigningMethod",
		Description: "The signing method for JWT. Valid valus are HS256, HS384, HS512",
		Type:        conf.StringType,
		Default:     "HS256",
	},
	{
		Name:        "Audience",
		Description: "The value for the JWT token audience",
		Type:        conf.StringType,
		Default:     "cisd",
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
	{
		Name:        "DefaultChangeOnDuty",
		Type:        conf.StringType,
		Description: "The default value for ChangeOnDuty in [OpeningHour]",
		Required:    true,
	},
	{
		Name:        "TimeZone",
		Type:        conf.StringType,
		Description: "The time zone to use for dates and times in the configuration",
		Default:     "UTC",
	},
	{
		Name:        "UnknownContactName",
		Description: "The name of the 'unknown' contact or the special value ${caller}",
		Type:        conf.StringType,
	},
	{
		Name:        "UnknownContactSource",
		Description: "The 'customer-source' of the unknown contact",
		Type:        conf.StringType,
		Default:     "unknown",
	},
	{
		Name:        "UnknownContactID",
		Description: "The ID of the unknown contact",
		Type:        conf.IntType,
		Default:     "1",
	},
}
