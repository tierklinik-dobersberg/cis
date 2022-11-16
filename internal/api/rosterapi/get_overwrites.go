package rosterapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetOverwritesEndpoint returns all duty-roster overwrites between two specified
// date-times.
func GetOverwritesEndpoint(router *app.Router) {
	router.GET(
		"v1/overwrites",
		permission.OneOf{
			ReadRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			fromStr := c.QueryParam("from")
			toStr := c.QueryParam("to")

			if fromStr == "" {
				return httperr.MissingParameter("from")
			}
			if toStr == "" {
				return httperr.MissingParameter("to")
			}

			from, err := app.ParseTime(time.RFC3339, fromStr)
			if err != nil {
				return httperr.InvalidParameter("from", err.Error())
			}
			to, err := app.ParseTime(time.RFC3339, toStr)
			if err != nil {
				return httperr.InvalidParameter("to", err.Error())
			}
			includeDeleted := c.QueryParams().Has("with-deleted")

			overwrites, err := app.OnCallOverwrites.GetOverwrites(ctx, from, to, includeDeleted)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, overwrites)
		},
	)
}
