package configapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

// GetFlatConfigEndpoint provides access to the UI configuration.
func GetFlatConfigEndpoint(grp *app.Router) {
	grp.GET(
		"v1/flat",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			// NORELEASE(ppacher): check for permissions when reading configuration data!
			keys := c.QueryParams()["keys"]

			schemas := runtime.GlobalSchema.Schemas()
			lm := make(map[string]bool)
			for _, s := range schemas {
				// skip internal schemas
				if s.Internal {
					continue
				}
				lm[s.Name] = s.Multi
			}

			resp := make(map[string]interface{})
			for _, key := range keys {
				multi, ok := lm[key]
				if !ok {
					return httperr.NotFound("schema-type", key)
				}

				values, err := runtime.GlobalSchema.SchemaAsMap(ctx, key)
				if err != nil {
					logger.From(ctx).Errorf("failed to get schema for key %s: %s", key, err)
					return echo.NewHTTPError(http.StatusInternalServerError, "failed to get values for "+key).
						SetInternal(err)
				}

				if multi {
					var res []interface{}
					for _, s := range values {
						res = append(res, s)
					}
					resp[key] = res
				} else {
					// there should only be once entry in this map
					for _, s := range values {
						resp[key] = s
					}
				}
			}

			return c.JSON(http.StatusOK, resp)
		},
	)
}
