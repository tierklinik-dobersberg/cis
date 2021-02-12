package importapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// NeumayrContactsAction defines the action that must be permitted in order
	// to be able to import contact information from Neumayr.
	NeumayrContactsAction = permission.MustDefineAction(
		"import:neumayr:contacts",
		"Permission required to import contacts from Neumayr",
		nil,
	)
)
