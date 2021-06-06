package rosterapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func DeleteOverwriteEndpoint(router *app.Router) {
	router.DELETE(
		"v1/overwrite",
		permission.OneOf{
			WriteRosterOverwriteAction,
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

			if err := app.DutyRosters.DeleteOverwrite(ctx, d); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}
