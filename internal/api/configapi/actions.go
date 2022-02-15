package configapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	ConfigManagementAction = permission.MustDefineAction(
		"config:write",
		"Permission required to manage system configuration",
		nil,
	)
)
