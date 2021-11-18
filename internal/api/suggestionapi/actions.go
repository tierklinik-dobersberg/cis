package suggestionapi

import "github.com/tierklinik-dobersberg/cis/internal/permission"

var (
	ReadSuggestionsAction = permission.MustDefineAction(
		"suggestion:read",
		"Permission required to read suggestions",
		nil,
	)

	ApplySuggestionsAction = permission.MustDefineAction(
		"suggestion:apply",
		"Permission required to apply suggestions",
		nil,
	)
)
