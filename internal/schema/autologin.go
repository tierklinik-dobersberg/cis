package schema

import "github.com/ppacher/system-conf/conf"

// Autologin defines under which conditions a user is
// automatically logged in and receives a valid session
// token.
type Autologin struct {
	InCIDR []string
}

// AutologinSpec defines the different configuration stanzas available in the
// autologin section of a user definition.
var AutologinSpec = conf.SectionSpec{
	{
		Name:        "InCIDR",
		Description: "A network range or subnet that the request must originate from. See TrustedProxies= in [Global] as well.",
		Type:        conf.StringSliceType,
	},
}
