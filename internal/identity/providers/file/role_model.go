package file

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
)

type roleModel struct {
	identity.Role `section:"Role"`

	Permissions []*identity.Permission `section:"Permission"`
}

func (db *identDB) loadRoles(identityDir string) error {
	spec := conf.FileSpec{
		"Role":       identity.RoleSpec,
		"Permission": identity.PermissionSpec,
	}

	roleFiles, err := confutil.LoadFiles(identityDir, ".role", spec)
	if err != nil {
		return err
	}

	// build the roles map
	for _, f := range roleFiles {
		role, err := decodeRole(f)
		if err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		lowerName := strings.ToLower(role.Name)

		// ensure there are not duplicates and add ot the
		// role map.
		if _, ok := db.roles[lowerName]; ok {
			return fmt.Errorf("role with name %s already defined", lowerName)
		}
		db.roles[lowerName] = role
	}

	return nil
}

func decodeRole(f *conf.File) (*roleModel, error) {
	spec := conf.FileSpec{
		"Role":       identity.RoleSpec,
		"Permission": identity.PermissionSpec,
	}

	var role roleModel

	if err := conf.DecodeFile(f, &role, spec); err != nil {
		return nil, err
	}

	return &role, nil
}
