package externalapi

import "github.com/gin-gonic/gin"

// Setup configures all integrationapi endpoints.
func Setup(grp gin.IRouter) {
	CurrentDoctorOnDutyEndpoint(grp)
}
