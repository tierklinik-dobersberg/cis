package identitydb

import (
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

type user struct {
	schema.User

	permissions []*schema.Permission
}

func buildUser(f *conf.File, userPropertySpecs []conf.OptionSpec) (*user, error) {
	secs := f.GetAll("user")
	if len(secs) == 0 || len(secs) > 1 {
		return nil, ErrInvalidSectionCount
	}

	usr, err := schema.BuildUser(secs[0])
	if err != nil {
		return nil, err
	}

	u := &user{
		User: usr,
	}

	// Build permissions
	for _, psec := range f.GetAll("permission") {
		p, err := schema.BuildPermission(psec)
		if err != nil {
			return nil, err
		}

		u.permissions = append(u.permissions, p)
	}

	// Build custom user properties
	// We do not perform any validation here as sec.Options
	// is expected to have been validated already using Validate()
	// and Prepare.
	if len(userPropertySpecs) > 0 {
		u.Properties = make(map[string]interface{})
	L:
		for _, spec := range userPropertySpecs {
			if spec.Type.IsSliceType() {
				// collect all values
				var values []interface{}
				for _, opt := range secs[0].Options {
					if strings.ToLower(opt.Name) == strings.ToLower(spec.Name) {
						values = append(values, opt.Value)
					}
				}
				u.Properties[spec.Name] = values

			} else {
				// find the first value and continue with the property specs
				for _, opt := range secs[0].Options {
					if strings.ToLower(opt.Name) == strings.ToLower(spec.Name) {
						u.Properties[spec.Name] = opt.Value
						continue L
					}
				}
			}
		}
	}

	return u, nil
}
