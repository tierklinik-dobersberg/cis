package commentapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/comment/v1alpha"
)

func LoadCommentsForKeyEndpoint(router *app.Router) {
	router.GET(
		"v1/:key",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			prefix := false
			key := c.Param("key")
			if key == "" {
				return httperr.MissingParameter("key")
			}

			if prefixParam := c.QueryParam("prefix"); prefixParam != "" {
				b, err := strconv.ParseBool(prefixParam)
				if err != nil {
					return httperr.BadRequest(err)
				}
				prefix = b
			}

			comments, err := app.Comments.ByKey(ctx, key, prefix)
			if err != nil {
				return err
			}

			// make sure we send an empty array ([]) instead of null
			if comments == nil {
				comments = make([]v1alpha.Comment, 0)
			}

			return c.JSON(http.StatusOK, comments)
		},
	)
}
