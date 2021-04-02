package patientapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all patient API routes.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	PatientByIDEndpoint(router)
	ListCustomerPatientsEndpoint(router)
}
