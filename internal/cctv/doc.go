package cctv

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

var CameraUnit = autodoc.MustRegister(autodoc.File{
	Name:           ".camera",
	Multiple:       true,
	Description:    "Describes and registers a CCTV or IP camera",
	DropinsAllowed: true,
	Sections: conf.FileSpec{
		"Camera":      CameraMetaSpec,
		"MJPEGSource": MJPEGSourceSpec,
	},
	Example: `
	[Camera]
	Name=Cat Cage Space
	Description=Cage Space for Cats
	Location=Main Building
	Type=Maginon IPC-1

	[MJPEGSource]
	URL=http://192.168.0.50/videostream.cgi?user=admin&pwd=test
	`,
	ExampleDescription: "Integrates a Maginon IPC-1 camera.",
	Template: `
	[Camera]
	Name=
	#Description=
	#Location=
	#Type=
	
	[MJPEGSource]
	URL=
	`,
})
