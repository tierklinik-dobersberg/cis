package cfgspec

import "github.com/ppacher/system-conf/conf"

// VetInf describes the configuration required to import
// data from a Vetinf installation.
type VetInf struct {
	VetInfDirectory      string
	VetInfEncoding       string
	VetInfImportSchedule string
	VetInfUserIDProperty string
}

// VetInfSpec describes the allowed configuration directives for
// the Vetinf import.
var VetInfSpec = conf.SectionSpec{
	{
		Name:        "VetInfDirectory",
		Type:        conf.StringType,
		Required:    true,
		Description: "Path to the vetinf Infdat directory",
	},
	{
		Name:        "VetInfEncoding",
		Type:        conf.StringType,
		Default:     "IBM852",
		Description: "Text encoding of the Infdat DBase files",
	},
	{
		Name:        "VetInfImportSchedule",
		Type:        conf.StringType,
		Default:     "@every 10m",
		Description: "Schedule for the VetInf data import",
	},
	{
		Name:        "VetInfUserIDProperty",
		Type:        conf.StringType,
		Default:     "",
		Description: "The name of the user property that maps to the user identifier in VetInf.",
	},
}
