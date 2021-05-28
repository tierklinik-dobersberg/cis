package rosterapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetOverwriteEndpoint returns the duty-roster overwrite for the
// requested day.
func GetOverwriteEndpoint(router *app.Router) {
	router.GET(
		"v1/overwrite",
		permission.OneOf{
			ReadRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			date := c.Query("date")

			if date == "" {
				date = dateForCurrentRoster(ctx, app)
			}

			d, err := app.ParseTime("2006-1-2", date)
			if err != nil {
				return httperr.InvalidParameter("date")
			}

			overwrite, err := app.DutyRosters.GetOverwrite(ctx, d)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, overwrite)
			return nil
		},
	)
}
