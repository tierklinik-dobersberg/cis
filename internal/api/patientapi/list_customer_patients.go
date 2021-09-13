package patientapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListCustomerPatientsEndpoint(router *app.Router) {
	router.GET(
		"v1/:source/:cid",
		permission.OneOf{
			ReadPatientAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")
			cid := c.Param("cid")

			result, err := app.Patients.Search(
				ctx,
				new(patientdb.SearchOptions).
					ByCustomer(source, cid),
			)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, result)

			return nil
		},
	)
}
