package configapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type CreateConfigResponse struct {
	ID      string `json:"id"`
	Warning string `json:"warning,omitempty"`
}

type CreateConfigRequest struct {
	Config map[string]interface{} `json:"config"`
}

func CreateConfigEndpoint(r *app.Router) {
	r.POST(
		"v1/schema/:key",
		permission.OneOf{ConfigManagementAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			key := c.Param("key")

			spec, ok := runtime.GlobalSchema.OptionsForSection(key)
			if !ok {
				return httperr.NotFound("schema-type", key)
			}

			var req CreateConfigRequest
			if err := c.Bind(&req); err != nil {
				return err
			}

			// create a slice of options
			var options []conf.Option
			for name, val := range req.Config {
				opts, err := conf.EncodeToOptions(name, val)
				if err != nil {
					return httperr.BadRequest(echo.Map{
						"error": "invalid values for option",
						"name":  name,
					}).SetInternal(err)
				}

				options = append(options, opts...)
			}

			section := conf.Section{
				Name:    key,
				Options: options,
			}

			// apply defaults and validate the options against the spec
			sec, err := conf.Prepare(section, spec)
			if err != nil {
				return httperr.BadRequest(echo.Map{
					"error": err.Error(),
				}).SetInternal(err)
			}

			// finally, try to create it
			var warning string
			id, err := runtime.GlobalSchema.Create(ctx, key, sec.Options)
			if err != nil {
				warning, err = handleRuntimeError(err)
				if err != nil {
					return err
				}
			}

			c.JSON(http.StatusOK, CreateConfigResponse{
				ID:      id,
				Warning: warning,
			})

			return nil
		},
	)
}
