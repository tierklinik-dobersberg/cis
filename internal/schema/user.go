package schema

import "github.com/ppacher/system-conf/conf"

// UserSpec defines the schema of a user.
var UserSpec = []conf.OptionSpec{
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
		Name:        "MemberOf",
		Type:        conf.StringSliceType,
		Description: "List of group names the user is part of",
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
}
