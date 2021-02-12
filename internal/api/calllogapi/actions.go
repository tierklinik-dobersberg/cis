package calllogapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	// CreateRecordAction is the permission required to
	// create new calllog records.
	CreateRecordAction = permission.MustDefineAction(
		"calllog:create",
		"Permission to create a new CallLog record",
		nil,
	)

	// ReadRecordsAction is the permission required to
	// retrieve and read calllog records.
	ReadRecordsAction = permission.MustDefineAction(
		"calllog:read",
		"Permission required to retrieve and read any calllog record",
		nil,
	)
)
