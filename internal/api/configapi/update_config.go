package configapi

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type UpdateConfigResponse struct {
	ID      string `json:"id"`
	Warning string `json:"warning,omitempty"`
}

type UpdateConfigRequest struct {
	Config map[string]interface{} `json:"config"`
}

func UpdateConfigEndpoint(r *app.Router) {
	r.PUT(
		"v1/schema/:key/:id",
		permission.OneOf{ConfigManagementAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			key := c.Param("key")
			id := c.Param("id")

			var req UpdateConfigRequest
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

			current := &conf.File{
				Sections: []conf.Section{
					{
						Name:    val.Name,
						Options: options,
					},
				},
			}

			if err := conf.ValidateFile(current, runtime.GlobalSchema); err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, err.Error()).SetInternal(err)
			}

			// NORELEASE: debug code
			_ = conf.WriteSectionsTo(current.Sections, os.Stderr)

			var warning string
			if err := runtime.GlobalSchema.Update(ctx, id, key, options); err != nil {
				warning, err = handleRuntimeError(err)
				if err != nil {
					return err
				}
			}

			c.JSON(http.StatusOK, UpdateConfigResponse{
				ID:      id,
				Warning: warning,
			})

			return nil
		},
	)
}

func handleRuntimeError(err error) (string, error) {
	var notifErr *runtime.NotificationError
	if errors.As(err, &notifErr) {
		return notifErr.Wrapped.Error(), nil
	}

	if errors.Is(err, runtime.ErrReadOnly) {
		return "", echo.NewHTTPError(http.StatusNotImplemented, "configuration is read-only")
	}
	return "", err
}
