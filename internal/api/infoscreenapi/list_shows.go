package infoscreenapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/infoscreen/v1alpha"
)

func ListShowsEndpoint(router *app.Router) {
	router.GET(
		"v1/shows",
		permission.OneOf{
			ActionShowsRead,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			shows, err := app.InfoScreenShows.ListShows(ctx)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, v1alpha.ListShowsResponse{
				Shows: shows,
			})
			return nil
		},
	)
}
