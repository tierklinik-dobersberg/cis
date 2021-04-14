package schema

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// User describes a single user definition.
type User struct {
	v1alpha.User

	AvatarFile   string
	PasswordHash string
	PasswordAlgo string
}

// UserSpec defines the schema of a user.
var UserSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Type:        conf.StringType,
		Default:     "%N",
		Required:    true,
		Description: "The name of the user.",
	},
	{
		Name:        "Fullname",
		Type:        conf.StringType,
		Description: "The full name of the user.",
	},
	{
		Name:        "Mail",
		Type:        conf.StringSliceType,
		Description: "A list of email address for the user",
	},
	{
		Name:        "PhoneNumber",
		Type:        conf.StringSliceType,
		Description: "A list of phone numbers for the user",
	},
	{
		Name:        "Roles",
		Type:        conf.StringSliceType,
		Description: "List of roles the user has",
	},
	{
		Name:        "PasswordHash",
		Type:        conf.StringType,
		Description: "The value of the user password following PasswordAlgo",
	},
	{
		Name:        "PasswordAlgo",
		Type:        conf.StringType,
		Description: "The algorithm used to create PasswordHash.",
	},
	{
		Name:        "AvatarFile",
		Type:        conf.StringType,
		Description: "Path to the avatar file name. Relative to AvatarDirectory.",
	},
	{
		Name:        "CalendarID",
		Type:        conf.StringType,
		Description: "The ID of the calendar that belongs to that user",
	},
	{
		Name:        "Color",
		Type:        conf.StringType,
		Description: "A Hex encoded color that should be used to represent the user in the UI. The color may container an alpha channel as well.",
	},
	{
		Name:        "Disabled",
		Type:        conf.BoolType,
		Default:     "no",
		Description: "Whether or not the user is disabled.",
	},
}
