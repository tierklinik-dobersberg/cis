package identityapi

import (
	"context"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func CreateEditUserEndpoint(r *app.Router) {
	r.POST(
		"v1/users/:username",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return createOrEditUser(ctx, app, c, false)
		},
	)

	r.PUT(
		"v1/users/:username",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return createOrEditUser(ctx, app, c, true)
		},
	)
}

func createOrEditUser(ctx context.Context, app *app.App, c echo.Context, edit bool) error {
	return nil
}
