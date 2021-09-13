package cfgspec

import "github.com/ppacher/system-conf/conf"

type MongoLogConfig struct {
	Enabled      bool
	PackageLevel []string
	DefaultLevel string
}

var MongoLogSpec = conf.SectionSpec{
	{
		Name:        "Enabled",
		Type:        conf.BoolType,
		Default:     "no",
		Description: "Whether or not logs should be stored in mongodb.",
	},
	{
		Name:        "PackageLevel",
		Type:        conf.StringSliceType,
		Description: "Log levels on a per package basis. Format is <package>=<log-level>",
	},
	{
		Name:        "DefaultLevel",
		Type:        conf.StringType,
		Default:     "error",
		Description: "Minimum logging level used if not overwritten by PackageLevel.",
	},
}
