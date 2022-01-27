package suggestionapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all API endpoints for the customer api.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/suggestions/v1/
	GetSuggestionsEndpoint(router)

	// POST /api/suggestions/v1/:type
	ApplySuggestionEndpoint(router)

	// DELETE /api/suggestions/v1/:id
	DeleteSuggestionEndpoint(router)
}
