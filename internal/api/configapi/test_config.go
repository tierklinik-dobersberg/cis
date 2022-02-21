package configapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type TestConfigRequest struct {
	Config     map[string]interface{} `json:"config"`
	TestConfig map[string]interface{} `json:"testConfig"`
}

func TestConfigEndpoint(r *app.Router) {
	r.POST(
		"v1/test/:key/:testID",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			schemaType := c.Param("key")
			testID := c.Param("testID")

			var req TestConfigRequest
			if err := c.Bind(&req); err != nil {
				return err
			}

			configOptions, err := confutil.MapToOptions(req.Config)
			if err != nil {
				return err
			}

			testOptions, err := confutil.MapToOptions(req.TestConfig)
			if err != nil {
				return err
			}

			testRes, err := runtime.GlobalSchema.Test(ctx, schemaType, testID, configOptions, testOptions)
			if err != nil {
				switch {
				case errors.Is(err, runtime.ErrCfgSectionNotFound):
					return httperr.NotFound("schema-type", schemaType)
				case errors.Is(err, runtime.ErrUnknownConfigTest):
					return httperr.NotFound("test-id", testID)
				default:
					return err
				}
			}

			return c.JSON(
				http.StatusOK,
				testRes,
			)
		},
	)
}
