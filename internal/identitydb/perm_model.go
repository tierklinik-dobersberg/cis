package identitydb

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type permission struct {
	v1alpha.Permission
}

func buildPermission(sec conf.Section) (*permission, error) {
	p := new(permission)

	var err error
	p.Description, err = getOptionalString(sec, "Description")
	if err != nil {
		return nil, fmt.Errorf("Permission.Description: %w", err)
	}

	p.Effect, err = sec.GetString("Effect")
	if err != nil {
		return nil, fmt.Errorf("Permission.Effect: %w", err)
	}

	p.Resources = sec.GetStringSlice("Resource")
	p.Domains = sec.GetStringSlice("Domain")

	return p, nil
}
