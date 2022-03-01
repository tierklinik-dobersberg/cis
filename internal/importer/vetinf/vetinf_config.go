package vetinf

import "github.com/ppacher/system-conf/conf"

// VetInf describes the configuration required to import
// data from a Vetinf installation.
type VetInf struct {
	Directory      string
	Encoding       string
	ImportSchedule string
	UserIDProperty string
}

// VetInfSpec describes the allowed configuration directives for
// the Vetinf import.
var VetInfSpec = conf.SectionSpec{
	{
		Name:        "Directory",
		Type:        conf.StringType,
		Required:    true,
		Description: "Path to the vetinf Infdat directory",
	},
	{
		Name:        "Encoding",
		Type:        conf.StringType,
		Default:     "IBM852",
		Description: "Text encoding of the Infdat DBase files",
	},
	{
		Name:        "ImportSchedule",
		Type:        conf.StringType,
		Default:     "@every 10m",
		Description: "Schedule for the VetInf data import",
	},
	{
		Name:        "UserIDProperty",
		Type:        conf.StringType,
		Default:     "",
		Description: "The name of the user property that maps to the user identifier in VetInf.",
	},
}
