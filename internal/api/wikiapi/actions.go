package wikiapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	ActionWriteCollections = permission.MustDefineAction(
		"wiki:write:collection",
		"Permission required to write collections",
		nil,
	)

	ActionReadCollections = permission.MustDefineAction(
		"wiki:read:collection",
		"Permission required to read collections",
		nil,
	)

	ActionDocumentRead = permission.MustDefineAction(
		"wiki:read:document",
		"Permission required to read documents.",
		nil,
	)

	ActionDocumentWrite = permission.MustDefineAction(
		"wiki:write:document",
		"Permission required to write/edit documents",
		nil,
	)
)
