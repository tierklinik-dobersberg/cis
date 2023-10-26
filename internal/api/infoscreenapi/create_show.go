package infoscreenapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/models/infoscreen/v1alpha"
)

func CreateShowEndpoint(router *app.Router) {
	router.POST(
		"v1/show/:show",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			showName := c.Param("show")

			var show v1alpha.Show
			if err := json.NewDecoder(c.Request().Body).Decode(&show); err != nil {
				return err
			}
			if show.Name == "" {
				show.Name = showName
			} else if show.Name != showName {
				// TODO(ppacher): this is a rename operation. handle it!
				return errors.New("rename not yet supported")
			}

			if err := app.InfoScreenShows.SaveShow(ctx, show); err != nil {
				return err
			}

			return c.NoContent(http.StatusCreated)
		},
	)
}
