package rosterapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetActiveOverwriteEndpoint returns the duty-roster overwrite for the
// requested day.
func GetActiveOverwriteEndpoint(router *app.Router) {
	router.GET(
		"v1/overwrite",
		permission.OneOf{
			ReadRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			date := c.Query("date")

			var d time.Time = time.Now()
			if date != "" {
				var err error
				d, err = app.ParseTime(time.RFC3339, date)
				if err != nil {
					return httperr.InvalidParameter("date", err.Error())
				}
			}

			overwrite, err := app.DutyRosters.GetActiveOverwrite(ctx, d)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, overwrite)
			return nil
		},
	)
}
