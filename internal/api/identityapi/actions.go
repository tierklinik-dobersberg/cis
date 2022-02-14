package identityapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	ManageUserAction = permission.MustDefineAction(
		"user:admin",
		"Permission required to manage user accounts",
		nil,
	)
)
