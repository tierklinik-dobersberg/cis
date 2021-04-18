package cfgspec

import "github.com/ppacher/system-conf/conf"

type MongoLogConfig struct {
	Enabled      bool
	PackageLevel []string
	DefaultLevel int
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
		Type:        conf.IntType,
		Default:     "0",
		Description: "Minimum logging level used if not overwritten by PackageLevel.",
	},
}
