package externalapi

import "github.com/gin-gonic/gin"

// Setup configures all integrationapi endpoints.
func Setup(grp gin.IRouter) {
	// GET /api/external/v1/doctor-on-duty
	CurrentDoctorOnDutyEndpoint(grp)

	// POST /api/external/v1/calllog?ani=<ani>&did=<did>
	RecordCallEndpoint(grp)
}
