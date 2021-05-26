package resourcedb

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

var ResourceUnit = autodoc.MustRegister(autodoc.File{
	Name:        ".resource",
	Multiple:    true,
	Description: "Resource definitions",
	Sections: conf.FileSpec{
		"Resource": ResourceSpec,
	},
	Example: `,
	[Resource]
	Name=Surgery Room 1
	MaxConcurrentUse=2
	Description=Our main surgery room with two tables.`,
	Template: `
	[Resource]
	Name=
	Description=
	Location=
	MaxConcurrentUse=1
	`,
})
