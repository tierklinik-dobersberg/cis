package schema

import "github.com/ppacher/system-conf/conf"

// UI groups settings that only relate to the user
// interface and are not directly used by cisd.
// Values here are made available through
// /api/config/v1/ui
type UI struct {
	HideUsersWithRole []string
}

// UISpec defines what configuration stanzas are supported
var UISpec = conf.SectionSpec{
	{
		Name:        "HideUsersWithRole",
		Description: "A list or role names. All users that have one of the given roles are hidden from (most parts of) the UI",
		Type:        conf.StringSliceType,
	},
}

// ExternalLink defines an external link to be displayed in the
// user interface.
type ExternalLink struct {
	ParentMenu   string
	Text         string
	Icon         string
	Link         string
	RequiresRole []string
}

// ExternalLinkSpec defines the configuration stanzas for an
// external link.
var ExternalLinkSpec = conf.SectionSpec{
	{
		Name:        "ParentMenu",
		Description: "The parent menu item",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "Text",
		Description: "The display text for the link",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "Icon",
		Description: "The name of the icon to display",
		Type:        conf.StringType,
	},
	{
		Name:        "Link",
		Description: "The target for the link",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "RequiresRole",
		Description: "The link requires one of the defined roles",
		Type:        conf.StringSliceType,
	},
}
