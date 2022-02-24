package identityapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

func CreatePermissionEndpoint(r *app.Router) {
	r.POST(
		"v1/permissions/:scope/:owner",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			manager, err := getManager(app)
			if err != nil {
				return err
			}

			scope := c.Param("scope")
			owner := c.Param("owner")

			var req v1alpha.Permission
			if err := c.Bind(&req); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}

			permID, err := manager.CreatePermission(ctx, scope, owner, identity.Permission{
				Permission: req,
			})
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, echo.Map{
				"id": permID,
			})
		},
	)
}

func DeletePermissionEndpoint(r *app.Router) {
	r.DELETE(
		"v1/permissions/:scope/:owner/:id",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			manager, err := getManager(app)
			if err != nil {
				return err
			}

			scope := c.Param("scope")
			owner := c.Param("owner")
			permID := c.Param("id")

			if err := manager.DeletePermission(ctx, scope, owner, permID); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
