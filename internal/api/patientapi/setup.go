package patientapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all patient API routes.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	PatientByIDEndpoint(router)
	ListCustomerPatientsEndpoint(router)
}
