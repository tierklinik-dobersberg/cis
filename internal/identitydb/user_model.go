package identitydb

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type user struct {
	v1alpha.User

	passwordHash string
	passwordAlgo string

	permissions []*permission
}

func buildUser(f *conf.File) (*user, error) {
	u := new(user)

	secs := f.GetAll("user")
	if len(secs) == 0 || len(secs) > 1 {
		return nil, ErrInvalidSectionCount
	}
	sec := secs[0]

	var err error
	u.Name, err = sec.GetString("Name")
	if err != nil {
		return nil, fmt.Errorf("user.Name: %w", err)
	}

	u.passwordAlgo, err = getOptionalString(sec, "PasswordAlgo")
	if err != nil {
		return nil, fmt.Errorf("user.PasswordAlgo: %w", err)
	}

	u.passwordHash, err = getOptionalString(sec, "PasswordHash")
	if err != nil {
		return nil, fmt.Errorf("user.PasswordHash: %w", err)
	}

	alogIsSet := u.passwordAlgo != ""
	hashIsSet := u.passwordHash != ""

	if alogIsSet != hashIsSet {
		return nil, fmt.Errorf("user.PasswordHash and user.PasswordAlgo must both be set or empty")
	}

	u.Fullname, err = getOptionalString(sec, "Fullname")
	if err != nil {
		return nil, fmt.Errorf("user.Fullname: %w", err)
	}

	u.Mail = sec.GetStringSlice("Mail")
	u.PhoneNumber = sec.GetStringSlice("PhoneNumber")
	u.GroupNames = sec.GetStringSlice("MemberOf")

	for _, psec := range f.GetAll("permission") {
		p, err := buildPermission(psec)
		if err != nil {
			return nil, err
		}

		u.permissions = append(u.permissions, p)
	}

	return u, nil
}
