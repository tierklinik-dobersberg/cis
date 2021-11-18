package suggestionapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all API endpoints for the customer api.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/suggestions/v1/
	GetSuggestionsEndpoint(router)

	// POST /api/suggestions/v1/:type
	ApplySuggestionEndpoint(router)

	// DELETE /api/suggestions/v1/:id
	DeleteSuggestionEndpoint(router)
}
