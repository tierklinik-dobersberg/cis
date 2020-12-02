package identitydb

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

type group struct {
	schema.Group

	permissions []*schema.Permission
}

func buildGroup(f *conf.File) (*group, error) {
	secs := f.GetAll("Group")
	if len(secs) == 0 || len(secs) > 1 {
		return nil, ErrInvalidSectionCount
	}

	grp, err := schema.BuildGroup(secs[0])
	if err != nil {
		return nil, err
	}

	g := &group{
		Group: grp,
	}

	for _, psec := range f.GetAll("permission") {
		p, err := schema.BuildPermission(psec)
		if err != nil {
			return nil, err
		}

		g.permissions = append(g.permissions, p)
	}

	return g, nil
}
