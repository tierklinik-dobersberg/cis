package patientapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
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
		func(ctx context.Context, app *app.App, c echo.Context) error {
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

			return c.JSON(http.StatusOK, result)
		},
	)
}
