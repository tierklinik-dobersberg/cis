package schema

import "github.com/ppacher/system-conf/conf"

// VetInf describes the configuration required to import
// data from a Vetinf installation.
type VetInf struct {
	VetInfDirectory string
	VetInfEncoding  string
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
}
