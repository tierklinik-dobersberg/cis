package customerapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// ReadCustomerAction is the action that must be permitted in order
	// to read customer data.
	ReadCustomerAction = permission.MustDefineAction(
		"customer:read",
		"Permission required to read customers",
		nil,
	)

	DeleteCustomerAction = permission.MustDefineAction(
		"customer:delete",
		"Permission required to delete customers",
		nil,
	)
)
