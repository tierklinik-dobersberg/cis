package schema

import "github.com/ppacher/system-conf/conf"

type Config struct {
	Secret        string
	AccessLogFile string
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
}
