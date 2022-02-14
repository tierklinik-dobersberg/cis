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

func RoleManagementEndpoints(r *app.Router) {
	r.GET(
		"v1/roles",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			roles, err := app.Identities.ListRoles(ctx)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, roles)
			return nil
		},
	)

	r.POST(
		"v1/roles/:role",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			roleName := c.Param("role")
			mng, err := getManager(app)
			if err != nil {
				return err
			}

			var request v1alpha.Role
			if err := c.Bind(&request); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}
			request.Name = roleName

			if err := mng.CreateRole(ctx, request); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)
}

func EditRoleEndpoint(r *app.Router) {
	r.PUT(
		"v1/roles/:role",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			roleName := c.Param("role")
			mng, err := getManager(app)
			if err != nil {
				return err
			}

			var request v1alpha.Role
			if err := c.Bind(&request); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}

			if err := mng.EditRole(ctx, roleName, request); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)
}

func DeleteRoleEndpoint(r *app.Router) {
	r.DELETE(
		"v1/roles/:role",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			roleName := c.Param("role")
			mng, err := getManager(app)
			if err != nil {
				return err
			}

			if err := mng.DeleteRole(ctx, roleName); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)
}

func GetRoleEndpoint(r *app.Router) {
	r.GET(
		"v1/roles/:role",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			roleName := c.Param("role")

			role, err := app.Identities.GetRole(ctx, roleName)
			if err != nil {
				return err
			}

			permissions, err := app.Identities.GetRolePermissions(ctx, roleName)
			if err != nil {
				return err
			}

			response := struct {
				v1alpha.Role
				Permissions []v1alpha.Permission `json:"permissions"`
			}{
				Role: role.Role,
			}

			for _, p := range permissions {
				response.Permissions = append(response.Permissions, p.Permission)
			}

			c.JSON(http.StatusOK, response)
			return nil
		},
	)
}

func getManager(app *app.App) (identity.ManageUserSupport, error) {
	manager, ok := app.Identities.(identity.ManageUserSupport)
	if !ok {
		return nil, echo.NewHTTPError(http.StatusNotImplemented, "identity provider does not ")
	}
	return manager, nil
}
