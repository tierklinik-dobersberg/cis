package identitydb

import (
	"context"
	"fmt"
	"strings"

	"github.com/nyaruka/phonenumbers"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
)

type user struct {
	cfgspec.User `section:"User"`

	Permissions []*cfgspec.Permission `section:"Permission"`
}

func (db *identDB) loadUsers(identityDir string) error {
	userPropertySpecs := make([]conf.OptionSpec, len(db.userPropertySpecs))
	for idx, opt := range db.userPropertySpecs {
		userPropertySpecs[idx] = opt.OptionSpec
	}

	spec := conf.FileSpec{
		"User":       conf.SectionSpec(append(cfgspec.UserSpec, userPropertySpecs...)),
		"Permission": cfgspec.PermissionSpec,
	}
	if db.httpConditionRegistry != nil {
		spec["AutoLogin"] = confutil.MultiOptionRegistry{
			db.httpConditionRegistry,
			conf.SectionSpec{
				{
					Name:        "CreateSession",
					Type:        conf.BoolType,
					Description: "Whether or not a new session should be created or if only this request should be authorized",
					Default:     "no",
				},
			},
		}
	}

	userFiles, err := confutil.LoadFiles(identityDir, ".user", spec)
	if err != nil {
		return err
	}

	// build the user map
	for _, f := range userFiles {
		u, autologin, err := buildUser(f, userPropertySpecs, db.httpConditionRegistry, db.country)
		if err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		lowerName := strings.ToLower(u.Name)

		// ensure there are no duplicates and add to the user map.
		if _, ok := db.users[lowerName]; ok {
			return fmt.Errorf("user with name %s already defined", lowerName)
		}
		db.users[lowerName] = u

		// if the user has an autologin section defined
		// add it the the autologin map as well.
		if autologin != nil && len(autologin.Options) > 0 {
			db.autologinUsers[lowerName] = *autologin
		}
	}

	return nil
}

func buildUser(f *conf.File, userPropertySpecs []conf.OptionSpec, autologinConditions conf.OptionRegistry, country string) (*user, *conf.Section, error) {
	spec := conf.FileSpec{
		"User":       cfgspec.UserSpec,
		"Permission": cfgspec.PermissionSpec,
	}

	if autologinConditions != nil {
		spec["AutoLogin"] = autologinConditions
	}

	var u user
	if err := conf.DecodeFile(f, &u, spec); err != nil {
		return nil, nil, err
	}

	// validate phone numbers and convert them to international
	// format
	for idx, phone := range u.PhoneNumber {
		parsed, err := phonenumbers.Parse(phone, country)
		if err != nil {
			log.From(context.TODO()).Errorf("Failed to parse phone number %s from user %s: %s", phone, u.Name, err)
			continue
		}

		u.PhoneNumber[idx] = strings.ReplaceAll(
			phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL),
			" ",
			"",
		)
	}

	// Build custom user properties
	// We do not perform any validation here as sec.Options
	// is expected to have been validated already using Validate()
	// and Prepare.
	sec := f.Get("User") // there can only be one User section

	if len(userPropertySpecs) > 0 {
		u.Properties = make(map[string]interface{})
		for _, spec := range userPropertySpecs {
			hasValue := false

			// TODO(ppacher): update sec.GetAs to return a boolean as well.
			for _, opt := range sec.Options {
				if strings.ToLower(opt.Name) == strings.ToLower(spec.Name) {
					hasValue = true
					break
				}
			}

			if hasValue {
				u.Properties[spec.Name] = sec.GetAs(spec.Name, spec.Type)
			}
		}
	}

	var autologinSection *conf.Section
	if autologinConditions != nil {
		autologinSection = f.Get("AutoLogin")
	}

	return &u, autologinSection, nil
}
