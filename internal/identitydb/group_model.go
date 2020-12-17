package identitydb

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
)

type group struct {
	schema.Group `section:"Group"`

	Permissions []*schema.Permission `section:"Permission"`
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
