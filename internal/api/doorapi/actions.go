package doorapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// GetStateAction is the action that must be permitted to
	// retrieve and read the door state.
	GetStateAction = permission.MustDefineAction(
		"door:get",
		"Permission required to read door states",
		nil,
	)

	// SetStateAction is the action that must be permitted to
	// set the door state.
	SetStateAction = permission.MustDefineAction(
		"door:set",
		"Permission required to set the door state",
		nil,
	)
)
