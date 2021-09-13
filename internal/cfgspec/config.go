package cfgspec

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
)

// Config groups global configuration values that are used by various subsystems
// of cisd.
type Config struct {
	Secret        string
	BaseURL       string
	Country       string
	AccessLogFile string
	TimeZone      string
	LogLevel      string

	UnknownContactName   string
	UnknownContactSource string
	UnknownContactID     string

	DefaultOpenBefore time.Duration
	DefaultCloseAfter time.Duration

	DefaultOnCallDayStart   string
	DefaultOnCallNightStart string
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
		Name:        "DefaultOnCallDayStart",
		Type:        conf.StringType,
		Description: "Default value for OnCallDayStart= in [OpeningHour]",
	},
	{
		Name:        "DefaultOnCallNightStart",
		Type:        conf.StringType,
		Description: "Default value for OnCallNightStart= in [OpeningHour]",
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
		Type:        conf.StringType,
		Default:     "1",
	},
	{
		Name:        "LogLevel",
		Description: "The maximum log level that should be printed to console. Should either be a number or the special values 'trace' (7), 'debug' (6), 'info' (5), 'warn' (3) or 'error' (0)",
		Type:        conf.StringType,
		Default:     "info",
	},
}

// ParseLogLevel parses the string l and returns the respective logger.Severity.
// l should either be a number or the special values 'trace' (7), 'debug' (6),
// 'info' (5), 'warn' (3) or 'error' (0).
func ParseLogLevel(l string) (logger.Severity, error) {
	switch strings.ToLower(l) {
	case "trace":
		return 7, nil
	case "debug":
		return 6, nil
	case "info":
		return 5, nil
	case "warn":
		return 3, nil
	case "error":
		return 0, nil
	default:
		v, err := strconv.ParseInt(l, 10, 0)
		if err != nil {
			return 0, fmt.Errorf("failed to parse log-level %q: %w", l, err)
		}
		if v < 0 {
			return 0, fmt.Errorf("invalid log level %q", l)
		}
		return logger.Severity(v), nil
	}
}
