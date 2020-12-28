package schema

import (
	"time"

	"github.com/ppacher/system-conf/conf"
)

type Config struct {
	Secret                 string
	AccessLogFile          string
	OpeningHourDatesFormat string
}

var ConfigSpec = conf.SectionSpec{
	{
		Name:        "Secret",
		Description: "Secret used to sign various data like session cookies. If empty, a temporary secret is created.",
		Type:        conf.StringType,
	},
	{
		Name:        "AccessLogFile",
		Description: "Path to access lo file",
		Type:        conf.StringType,
	},
	{
		Name:        "OpeningHourDatesFormat",
		Type:        conf.StringType,
		Description: "The format used for [OpeningHour] Dates= stanza.",
		Default:     time.RFC3339,
	},
}
