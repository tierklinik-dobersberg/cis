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

type GetConfigByIDResponse struct {
	Config map[string]interface{} `json:"config"`
}

func GetConfigByIDEndpoint(r *app.Router) {
	r.GET(
		"v1/schema/:key/:id",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			key := c.Param("key")
			id := c.Param("id")

			if err := schemaAccessAllowed(key); err != nil {
				return err
			}

			cfgs, err := runtime.GlobalSchema.SchemaAsMap(ctx, key)
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

			cfg, ok := cfgs[id]
			if !ok {
				return httperr.NotFound("schema-id", id)
			}

			return c.JSON(http.StatusOK, GetConfigByIDResponse{
				Config: cfg,
			})
		},
	)
}

func schemaAccessAllowed(key string) error {
	schema, err := runtime.GlobalSchema.SchemaByName(key)
	if err != nil {
		return httperr.NotFound("schema-type", key)
	}
	if schema.Internal {
		return httperr.PreconditionFailed("access to schema not allowed")
	}

	return nil
}
