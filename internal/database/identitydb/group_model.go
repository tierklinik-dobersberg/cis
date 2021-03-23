package identitydb

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

type role struct {
	schema.Role `section:"Role"`

	Permissions []*schema.Permission `section:"Permission"`
}

func (db *identDB) loadRoles(identityDir string) error {
	spec := conf.FileSpec{
		"Role":       schema.RoleSpec,
		"Permission": schema.PermissionSpec,
	}
	if db.httpConditionRegistry != nil {
		spec["AutoAssign"] = db.httpConditionRegistry
	}

	roleFiles, err := utils.LoadFiles(identityDir, ".role", spec)
	if err != nil {
		return err
	}

	// build the roles map
	for _, f := range roleFiles {
		g, autoassign, err := decodeRole(f, db.httpConditionRegistry)
		if err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		lowerName := strings.ToLower(g.Name)

		// ensure there are not duplicates and add ot the
		// role map.
		if _, ok := db.roles[lowerName]; ok {
			return fmt.Errorf("role with name %s already defined", lowerName)
		}
		db.roles[lowerName] = g

		// if the role has an autoassign section defined
		// add it the the autologin map as well.
		if autoassign != nil && len(autoassign.Options) > 0 {
			db.autologinRoles[lowerName] = *autoassign
		}
	}
	return nil
}

func decodeRole(f *conf.File, cond *httpcond.Registry) (*role, *conf.Section, error) {
	spec := conf.FileSpec{
		"Role":       schema.RoleSpec,
		"Permission": schema.PermissionSpec,
	}

	if cond != nil {
		spec["AutoAssign"] = cond
	}

	var grp role

	if err := spec.Decode(f, &grp); err != nil {
		return nil, nil, err
	}

	var autoassignSection *conf.Section
	if cond != nil {
		autoassignSection = f.Get("AutoAssign")
	}

	return &grp, autoassignSection, nil
}
