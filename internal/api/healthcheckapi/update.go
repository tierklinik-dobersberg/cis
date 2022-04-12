package healthcheckapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func UpdatePingEndpoints(router *app.Router) {
	var handler app.HandlerFunc = func(ctx context.Context, app *app.App, c echo.Context) error {
		name := c.Param("name")

		if strings.HasSuffix(c.Request().URL.Path, "/fail") {
			if err := app.Healtchecks.FailPing(ctx, name); err != nil {
				return err
			}
		} else {
			if err := app.Healtchecks.PingReceived(ctx, name, c.Request().Body); err != nil {
				return err
			}
		}

		return c.NoContent(http.StatusNoContent)
	}

	router.GET("v1/ping/:name", permission.Anyone, handler)
	router.POST("v1/ping/:name", permission.Anyone, handler)

	router.GET("v1/ping/:name/fail", permission.Anyone, handler)
	router.POST("v1/ping/:name/fail", permission.Anyone, handler)
}
