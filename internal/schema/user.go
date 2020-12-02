package schema

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type User struct {
	v1alpha.User

	PasswordHash string
	PasswordAlgo string
}

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

// BuildUser builds a user model form the specified section.
func BuildUser(sec conf.Section) (User, error) {
	var u User
	var err error

	u.Name, err = sec.GetString("Name")
	if err != nil {
		return u, fmt.Errorf("user.Name: %w", err)
	}

	u.PasswordAlgo, err = getOptionalString(sec, "PasswordAlgo")
	if err != nil {
		return u, fmt.Errorf("user.PasswordAlgo: %w", err)
	}

	u.PasswordHash, err = getOptionalString(sec, "PasswordHash")
	if err != nil {
		return u, fmt.Errorf("user.PasswordHash: %w", err)
	}

	alogIsSet := u.PasswordAlgo != ""
	hashIsSet := u.PasswordHash != ""

	if alogIsSet != hashIsSet {
		return u, fmt.Errorf("user.PasswordHash and user.PasswordAlgo must both be set or empty")
	}

	u.Fullname, err = getOptionalString(sec, "Fullname")
	if err != nil {
		return u, fmt.Errorf("user.Fullname: %w", err)
	}

	u.Mail = sec.GetStringSlice("Mail")
	u.PhoneNumber = sec.GetStringSlice("PhoneNumber")
	u.GroupNames = sec.GetStringSlice("MemberOf")

	return u, nil
}
