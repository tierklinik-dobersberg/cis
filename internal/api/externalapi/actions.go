package externalapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// ReadOnDutyAction is the action that must be permitted to read
	// "doctors-on-duty".
	ReadOnDutyAction = permission.MustDefineAction(
		"external:read-on-duty",
		"Permission required to read the doctors-on-duty",
		nil,
	)

	// GetContactAction is the action that must be permitted to read
	// contact data.
	GetContactAction = permission.MustDefineAction(
		"external:read-contact",
		"Permission required to read contacts",
		nil,
	)
)
