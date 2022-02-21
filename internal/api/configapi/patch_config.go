package configapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type PatchConfigResponse struct {
	ID      string `json:"id"`
	Warning string `json:"warning,omitempty"`
}

type PatchConfigRequest struct {
	Config map[string]interface{} `json:"config"`
}

func PatchConfigEndpoint(r *app.Router) {
	r.PATCH(
		"v1/schema/:key/:id",
		permission.OneOf{ConfigManagementAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			key := c.Param("key")
			id := c.Param("id")

			var req PatchConfigRequest
			if err := c.Bind(&req); err != nil {
				return err
			}

			// create a slice of options
			options, err := confutil.MapToOptions(req.Config)
			if err != nil {
				return err
			}

			val, err := runtime.GlobalSchema.GetID(ctx, id)
			if err != nil {
				return err
			}

			if !strings.EqualFold(key, val.Name) {
				return httperr.NotFound("schema-type", key)
			}

			dropIn := &conf.DropIn{
				Sections: conf.Sections{
					{
						Name:    val.Name,
						Options: options,
					},
				},
			}
			current := &conf.File{
				Sections: []conf.Section{val.Section},
			}
			if err := conf.ApplyDropIns(current, []*conf.DropIn{dropIn}, runtime.GlobalSchema); err != nil {
				return err
			}

			if err := conf.ValidateFile(current, runtime.GlobalSchema); err != nil {
				return err
			}

			var warning string
			if err := runtime.GlobalSchema.Update(ctx, id, key, current.Sections[0].Options); err != nil {
				warning, err = handleRuntimeError(ctx, err)
				if err != nil {
					return err
				}
			}

			c.JSON(http.StatusOK, PatchConfigResponse{
				ID:      id,
				Warning: warning,
			})

			return nil
		},
	)
}
