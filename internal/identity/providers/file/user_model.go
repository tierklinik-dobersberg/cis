package file

import (
	"context"
	"fmt"
	"strings"

	"github.com/nyaruka/phonenumbers"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
)

type UserModel struct {
	identity.User `section:"User"`

	Permissions []*identity.Permission `section:"Permission"`
}

func (db *identDB) loadUsers(ctx context.Context, identityDir string) error {
	userPropertySpecs := make([]conf.OptionSpec, len(db.userPropertySpecs))
	for idx, opt := range db.userPropertySpecs {
		userPropertySpecs[idx] = opt.OptionSpec
	}

	spec := conf.FileSpec{
		"User":       append(identity.UserSpec, userPropertySpecs...),
		"Permission": identity.PermissionSpec,
	}

	userFiles, err := confutil.LoadFiles(identityDir, ".user", spec)
	if err != nil {
		return err
	}

	// build the user map
	for _, f := range userFiles {
		u, err := buildUser(ctx, f, userPropertySpecs, db.country)
		if err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		lowerName := strings.ToLower(u.Name)

		// ensure there are no duplicates and add to the user map.
		if _, ok := db.users[lowerName]; ok {
			return fmt.Errorf("user with name %s already defined", lowerName)
		}
		db.users[lowerName] = u
	}

	return nil
}

func buildUser(ctx context.Context, userCfgFile *conf.File, userPropertySpecs []conf.OptionSpec, country string) (*UserModel, error) {
	spec := conf.FileSpec{
		"User":       identity.UserSpec,
		"Permission": identity.PermissionSpec,
	}
	var user UserModel
	if err := conf.DecodeFile(userCfgFile, &user, spec); err != nil {
		return nil, err
	}

	// validate phone numbers and convert them to international
	// format
	for idx, phone := range user.PhoneNumber {
		parsed, err := phonenumbers.Parse(phone, country)
		if err != nil {
			log.From(ctx).Errorf("Failed to parse phone number %s from user %s: %s", phone, user.Name, err)

			continue
		}

		user.PhoneNumber[idx] = strings.ReplaceAll(
			phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL),
			" ",
			"",
		)
	}

	// Build custom user properties
	// We do not perform any validation here as sec.Options
	// is expected to have been validated already using Validate()
	// and Prepare.
	sec := userCfgFile.Get("User") // there can only be one User section

	if len(userPropertySpecs) > 0 {
		user.Properties = make(map[string]interface{})
		for _, spec := range userPropertySpecs {
			hasValue := false

			// TODO(ppacher): update sec.GetAs to return a boolean as well.
			for _, opt := range sec.Options {
				if strings.EqualFold(opt.Name, spec.Name) {
					hasValue = true

					break
				}
			}

			if hasValue {
				user.Properties[spec.Name] = sec.GetAs(spec.Name, spec.Type)
			}
		}
	}

	return &user, nil
}
