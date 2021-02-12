package rosterapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// WriteRosterAction defines the action that must be permitted to be able
	// to create and edit duty rosters.
	WriteRosterAction = permission.MustDefineAction(
		"roster:write",
		"Permission required to write duty rosters",
		nil,
	)

	// ReadRosterAction defines the action that must be permitted to be able
	// to retrieve and read duty rosters.
	ReadRosterAction = permission.MustDefineAction(
		"roster:read",
		"Permission required to read duty rosters",
		nil,
	)

	// WriteRosterOverwriteAction is the permission required to
	// create/delete duty-roster overwrites.
	WriteRosterOverwriteAction = permission.MustDefineAction(
		"roster:write:overwrite",
		"Permission rquired to place duty roster overwrites",
		nil,
	)

	// ReadRosterOverwriteAction is the permission required to
	// retrieve and read duty roster overwrites.
	ReadRosterOverwriteAction = permission.MustDefineAction(
		"roster:read:overwrite",
		"Permission required to read duty roster overwrites",
		nil,
	)
)
