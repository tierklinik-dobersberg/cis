package healthcheckapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/healthchecks"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

type GetPingRecordsResult struct {
	Records []healthchecks.PingRecord `json:"records"`
}

func GetPingRecordsEndpoint(router *app.Router) {
	router.GET(
		"v1/ping/:name/records",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var (
				from time.Time
				to   time.Time
			)

			if fromStr := c.QueryParam("from"); fromStr != "" {
				var err error
				from, err = app.ParseTime(time.RFC3339, fromStr)
				if err != nil {
					return httperr.InvalidParameter("from", fromStr)
				}
			}

			if toStr := c.QueryParam("to"); toStr != "" {
				var err error
				to, err = app.ParseTime(time.RFC3339, toStr)
				if err != nil {
					return httperr.InvalidParameter("to", toStr)
				}
			}

			pings, err := app.Healtchecks.FindPingRecords(ctx, c.Param("name"), from, to)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, GetPingRecordsResult{
				Records: pings,
			})
		},
	)
}
