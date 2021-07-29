package cfgspec

import (
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/service/svcenv"
)

type InfoScreenConfig struct {
	Enabled             bool     `option:"Enabled"`
	LayoutPaths         []string `option:"LayoutPath"`
	UploadDataDirectory string   `option:"UploadDataDirectory"`
	MaxUploadSize       string   `option:"MaxUploadSize"`
}

var InfoScreenConfigSpec = conf.SectionSpec{
	{
		Name:        "Enabled",
		Default:     "no",
		Description: "Whether or not to enable the info-screen module",
		Required:    false,
		Type:        conf.BoolType,
	},
	{
		Name:        "LayoutPath",
		Type:        conf.StringSliceType,
		Description: "One or more paths used to search for info-screen slide layouts",
		Required:    true,
	},
	{
		Name:        "UploadDataDirectory",
		Type:        conf.StringType,
		Description: "Directory that should be used to store uploaded files for infoscreen slides",
		Default:     filepath.Join(svcenv.Env().StateDirectory, "uploaded"),
	},
	{
		Name:        "MaxUploadSize",
		Type:        conf.StringType,
		Description: "The maximum allowed size of uploaded files. Supports K(ilo), M(ega) suffixes.",
		Default:     "1M",
	},
}
