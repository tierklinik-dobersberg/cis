package configapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

type uiResponseModel struct {
	app.UIConfig
	UserProperties []cfgspec.UserPropertyDefinition
}

// GetUIConfigEndpoint provides access to the UI configuration.
func GetUIConfigEndpoint(grp *app.Router) {
	grp.GET(
		"v1/ui",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			resp := uiResponseModel{
				UIConfig:       app.Config.UI,
				UserProperties: app.Config.UserProperties,
			}
			c.JSON(http.StatusOK, resp)

			return nil
		},
	)
}
