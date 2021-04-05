package externalapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
)

var log = pkglog.New("externalapi")

// Setup configures all integrationapi endpoints.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/external/v1/doctor-on-duty
	CurrentDoctorOnDutyEndpoint(router)

	// POST /api/external/v1/calllog?ani=<ani>&did=<did>
	RecordCallEndpoint(router)

	// GET /api/external/v1/contact?phone=<phone>
	GetContactEndpoint(router)
}
