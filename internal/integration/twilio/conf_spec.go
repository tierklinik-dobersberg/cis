package twilio

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
)

type AccountConfig struct {
	From       string
	AccountSid string
	Token      string
}

var AccountSpec = conf.SectionSpec{
	{
		Name:        "From",
		Type:        conf.StringType,
		Required:    true,
		Description: "The sender number or alphanumeric sender ID",
	},
	{
		Name:        "AccountSid",
		Type:        conf.StringType,
		Required:    true,
		Internal:    true,
		Description: "The twilio accound SID",
	},
	{
		Name:        "Token",
		Type:        conf.StringType,
		Required:    true,
		Internal:    true,
		Description: "The twilio authentication token",
	},
}

// RegisterGlobalSpec registers the global twilio section
// on reg.
func RegisterGlobalSpec(reg *cfgspec.GlobalConfigRegistry) {
	reg.RegisterSection(
		"Twilio",
		"Configure a twilio account to use for programmable messaging.",
		AccountSpec,
	)
}

func init() {
	RegisterGlobalSpec(cfgspec.DefaultRegistry)
}
