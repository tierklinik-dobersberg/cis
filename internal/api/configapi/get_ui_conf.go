package configapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
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
				lm[s.Name] = s.Multi
			}

			resp := make(map[string]interface{})
			for _, k := range keys {
				multi, ok := lm[k]
				if !ok {
					return httperr.NotFound("schema-type", k)
				}

				values, err := runtime.GlobalSchema.SchemaAsMap(ctx, k)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "failed to get values for "+k).
						SetInternal(err)
				}

				if multi {
					var res []interface{}
					for _, s := range values {
						res = append(res, s)
					}
					resp[k] = res
				} else {
					// there should only be once entry in this map
					for _, s := range values {
						resp[k] = s
					}
				}
			}

			c.JSON(http.StatusOK, resp)

			return nil
		},
	)
}
