package identitydb

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

type group struct {
	schema.Group `section:"Group"`

	Permissions []*schema.Permission `section:"Permission"`
}

func (db *identDB) loadGroups(identityDir string) error {
	groupsFiles, err := utils.LoadFiles(identityDir, ".group", conf.FileSpec{
		"Group":      schema.GroupSpec,
		"Permission": schema.PermissionSpec,
	})
	if err != nil {
		return err
	}

	// build the group map
	for _, f := range groupsFiles {
		g, err := decodeGroup(f)
		if err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		lowerName := strings.ToLower(g.Name)

		// ensure there are not duplicates and add ot the
		// group map.
		if _, ok := db.groups[lowerName]; ok {
			return fmt.Errorf("group with name %s already defined", lowerName)
		}
		db.groups[lowerName] = g
	}
	return nil
}

func decodeGroup(f *conf.File) (*group, error) {
	spec := conf.FileSpec{
		"Group":      schema.GroupSpec,
		"Permission": schema.PermissionSpec,
	}

	var grp group

	if err := spec.Decode(f, &grp); err != nil {
		return nil, err
	}

	return &grp, nil
}
