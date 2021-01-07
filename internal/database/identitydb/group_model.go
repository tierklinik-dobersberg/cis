package identitydb

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

type role struct {
	schema.Role `section:"Role"`

	Permissions []*schema.Permission `section:"Permission"`
}

func (db *identDB) loadRoles(identityDir string) error {
	roleFiles, err := utils.LoadFiles(identityDir, ".role", conf.FileSpec{
		"Role":       schema.RoleSpec,
		"Permission": schema.PermissionSpec,
	})
	if err != nil {
		return err
	}

	// build the roles map
	for _, f := range roleFiles {
		g, err := decodeRole(f)
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
	}
	return nil
}

func decodeRole(f *conf.File) (*role, error) {
	spec := conf.FileSpec{
		"Role":       schema.RoleSpec,
		"Permission": schema.PermissionSpec,
	}

	var grp role

	if err := spec.Decode(f, &grp); err != nil {
		return nil, err
	}

	return &grp, nil
}
