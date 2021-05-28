package patientapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func ListCustomerPatientsEndpoint(router *app.Router) {
	router.GET(
		"v1/:source/:cid",
		permission.OneOf{
			ReadPatientAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			source := c.Param("source")
			cidStr := c.Param("cid")

			id, err := strconv.ParseInt(cidStr, 10, 64)
			if err != nil {
				return httperr.InvalidParameter("cid")
			}

			result, err := app.Patients.Search(
				ctx,
				new(patientdb.SearchOptions).
					ByCustomer(source, int(id)),
			)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, result)

			return nil
		},
	)
}
