package rosterapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all API routes for the roster.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/dutyroster/v1/roster/:year/:month
	GetForMonthEndpoint(router)

	// DELETE /api/dutyroster/v1/roster/:year/:month
	DeleteRosterEndpoint(router)

	// PUT /api/dutyroster/v1/roster/:year/:month
	CreateOrUpdateEndpoint(router)

	// POST /api/dutyroster/v1/overwrite?date=<date>
	SetOverwriteEndpoint(router)

	// GET /api/dutyroster/v1/overwrite?date=<date>
	GetOverwriteEndpoint(router)

	// DELETE /api/dutyroster/v1/overwrite?date=<date>
	DeleteOverwriteEndpoint(router)
}
