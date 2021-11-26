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

	// GET /api/dutyroster/v1/roster/:year/:month/:day
	GetDayEndpoint(router)

	// DELETE /api/dutyroster/v1/roster/:year/:month
	DeleteRosterEndpoint(router)

	// PUT /api/dutyroster/v1/roster/:year/:month
	CreateOrUpdateEndpoint(router)

	// POST /api/dutyroster/v1/overwrite
	SetOverwriteEndpoint(router)

	// GET /api/dutyroster/v1/overwrites?from=<date>&to=<date>
	GetOverwritesEndpoint(router)

	// GET /api/dutyroster/v1/overwrite?date=<date>
	GetActiveOverwriteEndpoint(router)

	// DELETE /api/dutyroster/v1/overwrite?date=<date>
	DeleteActiveOverwriteEndpoint(router)

	// DELETE /api/dutyroster/v1/overwrite/:id
	DeleteOverwriteByIDEndpoint(router)
}
