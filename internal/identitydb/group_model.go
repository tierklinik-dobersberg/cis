package identitydb

import (
	"fmt"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/loader"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
)

type group struct {
	schema.Group `section:"Group"`

	Permissions []*schema.Permission `section:"Permission"`
}

func (db *identDB) loadGroups(identityDir string) error {
	groupsFiles, err := loader.LoadFiles(identityDir, ".group", conf.FileSpec{
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

		db.groups[strings.ToLower(g.Name)] = g
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
