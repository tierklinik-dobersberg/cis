package configapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type GetConfigsResponse struct {
	Configs map[string]map[string]interface{} `json:"configs"`
}

func GetConfigsEndpoint(r *app.Router) {
	r.GET(
		"v1/schema/:key",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			key := c.Param("key")

			if err := schemaAccessAllowed(key); err != nil {
				return err
			}

			cfgs, err := runtime.GlobalSchema.SchemaAsMap(ctx, key, false)
			if err != nil {
				if errors.Is(err, runtime.ErrCfgSectionNotFound) {
					return httperr.NotFound("schema-type", key)
				}

				// we ignore any unknown-section error since that just means
				// that no configuration exists for that kind.
				if !errors.Is(err, conf.ErrUnknownSection) {
					return err
				}
				cfgs = make(map[string]map[string]interface{}) // creat an empty map for the response
			}

			return c.JSON(http.StatusOK, GetConfigsResponse{
				Configs: cfgs,
			})
		},
	)
}
