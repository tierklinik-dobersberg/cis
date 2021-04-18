package cfgspec

import "github.com/ppacher/system-conf/conf"

// DatabaseConfig groups configuration options for the mongodb
// database.
type DatabaseConfig struct {
	// DatabaseURI holds the connection string to the MongoDB database.
	DatabaseURI string

	// DatabaseName holds the name of the mongodb database to use
	DatabaseName string
}

// DatabaseSpec describes the allowed configuration directives.
var DatabaseSpec = conf.SectionSpec{
	{
		Name:        "DatabaseURI",
		Type:        conf.StringType,
		Description: "The connection string for the MongoDB database",
		Required:    true,
	},
	{
		Name:        "DatabaseName",
		Type:        conf.StringType,
		Description: "The name of the MongoDB database",
		Default:     "cis",
	},
}
