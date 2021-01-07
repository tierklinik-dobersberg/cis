package identitydb

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

type user struct {
	schema.User `section:"User"`

	Permissions []*schema.Permission `section:"Permission"`
}

func (db *identDB) loadUsers(identityDir string) error {
	userFiles, err := utils.LoadFiles(identityDir, ".user", conf.FileSpec{
		"User":       conf.SectionSpec(append(schema.UserSpec, db.userPropertySpecs...)),
		"Permission": schema.PermissionSpec,
	})
	if err != nil {
		return err
	}

	// build the user map
	for _, f := range userFiles {
		u, autologin, err := buildUser(f, db.userPropertySpecs, db.autologinConditions)
		if err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		lowerName := strings.ToLower(u.Name)

		// ensure there are no duplicates and add to the user map
		if _, ok := db.users[lowerName]; ok {
			return fmt.Errorf("user with name %s already defined", lowerName)
		}
		db.users[lowerName] = u

		// if the user has an autologin section defined
		// add it the the autologin map as well.
		if autologin != nil && len(autologin.Options) > 0 {
			db.autologin[lowerName] = *autologin
		}
	}

	return nil
}

func buildUser(f *conf.File, userPropertySpecs []conf.OptionSpec, autologinConditions conf.OptionRegistry) (*user, *conf.Section, error) {
	spec := conf.FileSpec{
		"User":       schema.UserSpec,
		"Permission": schema.PermissionSpec,
	}

	if autologinConditions != nil {
		spec["AutoLogin"] = autologinConditions
	}

	var u user
	if err := spec.Decode(f, &u); err != nil {
		return nil, nil, err
	}

	// Build custom user properties
	// We do not perform any validation here as sec.Options
	// is expected to have been validated already using Validate()
	// and Prepare.
	sec := f.Get("User") // there can only be one User section

	if len(userPropertySpecs) > 0 {
		u.Properties = make(map[string]interface{})
		for _, spec := range userPropertySpecs {
			u.Properties[spec.Name] = sec.GetAs(spec.Name, spec.Type)
		}
	}

	var autologinSection *conf.Section
	if autologinConditions != nil {
		autologinSection = f.Get("AutoLogin")
	}

	return &u, autologinSection, nil
}
