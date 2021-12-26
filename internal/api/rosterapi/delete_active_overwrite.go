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

func DeleteActiveOverwriteEndpoint(router *app.Router) {
	router.DELETE(
		"v1/overwrite",
		permission.OneOf{
			WriteRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			d := time.Now()
			if date := c.Query("date"); date != "" {
				var err error
				d, err = app.ParseTime(time.RFC3339, date)
				if err != nil {
					return httperr.InvalidParameter("date", err.Error())
				}
			}

			if err := app.DutyRosters.DeleteActiveOverwrite(ctx, d); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}
