package commentapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/comment/v1alpha"
)

func LoadCommentsForKeyEndpoint(router *app.Router) {
	router.GET(
		"v1/:key",
		permission.Set{
			ReadCommentsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			key := c.Param("key")
			if key == "" {
				return httperr.BadRequest(nil)
			}

			comments, err := app.Comments.ByKey(ctx, key)
			if err != nil {
				return err
			}

			// make sure we send an empty array ([]) instead of null
			if comments == nil {
				comments = make([]v1alpha.Comment, 0)
			}

			c.JSON(http.StatusOK, comments)

			return nil
		},
	)
}
