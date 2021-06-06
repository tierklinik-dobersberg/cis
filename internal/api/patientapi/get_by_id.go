package patientapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func PatientByIDEndpoint(router *app.Router) {
	router.GET(
		"v1/:source/:cid/:aid",
		permission.OneOf{
			ReadPatientAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")
			cidStr := c.Param("cid")
			aid := c.Param("aid")

			id, err := strconv.ParseInt(cidStr, 10, 64)
			if err != nil {
				return httperr.InvalidParameter("cid")
			}

			patient, err := app.Patients.ByCustomerAndAnimalID(ctx, source, int(id), aid)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, patient)

			return nil
		},
	)
}
