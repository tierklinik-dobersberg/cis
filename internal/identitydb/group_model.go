package identitydb

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type group struct {
	v1alpha.Group

	permissions []*permission
}

func buildGroup(f *conf.File) (*group, error) {
	g := new(group)

	secs := f.GetAll("Group")
	if len(secs) == 0 || len(secs) > 1 {
		return nil, ErrInvalidSectionCount
	}
	sec := secs[0]

	var err error
	g.Name, err = sec.GetString("Name")
	if err != nil {
		return nil, fmt.Errorf("group.Name: %w", err)
	}

	g.Description, err = getOptionalString(sec, "Description")
	if err != nil {
		return nil, fmt.Errorf("group.Description: %w", err)
	}

	for _, psec := range f.GetAll("permission") {
		p, err := buildPermission(psec)
		if err != nil {
			return nil, err
		}

		g.permissions = append(g.permissions, p)
	}

	return g, nil
}
