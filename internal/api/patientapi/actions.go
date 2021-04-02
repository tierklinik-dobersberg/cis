package patientapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// ReadPatientAction is the action that must be permitted in order
	// to access patient data.
	ReadPatientAction = permission.MustDefineAction(
		"patient:read",
		"Permissoin to read patient data",
		nil,
	)
)
