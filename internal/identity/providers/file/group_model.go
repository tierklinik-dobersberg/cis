package file

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
)

type role struct {
	cfgspec.Role `section:"Role"`

	Permissions []*cfgspec.Permission `section:"Permission"`
}

func (db *identDB) loadRoles(identityDir string) error {
	spec := conf.FileSpec{
		"Role":       cfgspec.RoleSpec,
		"Permission": cfgspec.PermissionSpec,
	}

	roleFiles, err := confutil.LoadFiles(identityDir, ".role", spec)
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
		"Role":       cfgspec.RoleSpec,
		"Permission": cfgspec.PermissionSpec,
	}

	var grp role

	if err := conf.DecodeFile(f, &grp, spec); err != nil {
		return nil, err
	}

	return &grp, nil
}
