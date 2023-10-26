package configapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type SchemaModel struct {
	runtime.Schema
	Options []conf.OptionSpec `json:"options"`
}

type ListSchemasResponse struct {
	Schemas []SchemaModel `json:"schemas"`
}

func ListSchemasEndpoint(grp *app.Router) {
	grp.GET(
		"v1/schema",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			schemas := runtime.GlobalSchema.Schemas()
			var res ListSchemasResponse

			for _, s := range schemas {
				// skip schemas that are marked as internal.
				if s.Internal {
					continue
				}

				res.Schemas = append(res.Schemas, SchemaModel{
					Schema:  s,
					Options: s.Spec.All(),
				})
			}

			return c.JSON(http.StatusOK, res)
		},
	)
}
