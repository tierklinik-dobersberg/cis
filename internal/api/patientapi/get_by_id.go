package patientapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func PatientByIDEndpoint(router *app.Router) {
	router.GET(
		"v1/:source/:cid/:aid",
		permission.OneOf{
			ReadPatientAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")
			cid := c.Param("cid")
			aid := c.Param("aid")

			patient, err := app.Patients.ByCustomerAndAnimalID(ctx, source, cid, aid)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, patient)

			return nil
		},
	)
}
