package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func DeleteShowEndpoint(router *app.Router) {
	router.DELETE(
		"v1/shows/:show",
		permission.OneOf{
			ActionShowsDelete,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			showName := c.Param("show")

			if err := app.InfoScreenShows.DeleteShow(ctx, showName); err != nil {
				return nil
			}

			c.Status(http.StatusAccepted)
			return nil
		},
	)
}
