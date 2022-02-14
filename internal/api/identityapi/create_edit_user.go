package identityapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

func CreateEditUserEndpoint(r *app.Router) {
	r.POST(
		"v1/users/:username",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			username := c.Param("username")
			manager, err := getManager(app)
			if err != nil {
				return err
			}

			var request struct {
				v1alpha.User
				Password string `json:"password"`
			}

			if request.Name == "" {
				request.Name = username
			}

			if request.Name != username {
				return httperr.BadRequest().SetInternal(fmt.Errorf("username mismatch in path and body"))
			}

			if err := c.Bind(&request); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}

			var returnPassword bool
			// if there's no password for the new user generate a new random one
			// and force the user to change it
			if request.Password == "" {
				password, err := utils.Nonce(4)
				if err != nil {
					return httperr.InternalError().SetInternal(
						fmt.Errorf("failed to generate password: %w", err),
					)
				}
				request.Password = password
				request.NeedsPasswordChange = true
				returnPassword = true
			}

			if err := manager.CreateUser(
				ctx,
				request.User,
				request.Password,
			); err != nil {
				return err
			}

			if returnPassword {
				c.JSON(http.StatusOK, echo.Map{
					"password": request.Password,
				})
			} else {
				c.NoContent(http.StatusNoContent)
			}

			return nil
		},
	)

	r.PUT(
		"v1/users/:username",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			username := c.Param("username")
			manager, err := getManager(app)
			if err != nil {
				return err
			}

			var request struct {
				v1alpha.User
			}
			if err := c.Bind(&request); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}

			if request.Name != username {
				return httperr.BadRequest().SetInternal(fmt.Errorf("username mismatch in path and body"))
			}

			if err := manager.EditUser(ctx, username, request.User); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)

	r.GET(
		"v1/users/:username",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			username := c.Param("username")

			user, err := app.Identities.GetUser(ctx, username)
			if err != nil {
				return err
			}

			permissions, err := app.Identities.GetUserPermissions(ctx, username)
			if err != nil {
				return err
			}

			response := struct {
				v1alpha.User
				Permissions []v1alpha.Permission `json:"permissions"`
			}{
				User: user.User,
			}

			for _, p := range permissions {
				response.Permissions = append(response.Permissions, p.Permission)
			}

			c.JSON(http.StatusOK, response)

			return nil
		},
	)

	r.PUT(
		"v1/users/:username/password",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			changer, ok := app.Identities.(identity.PasswortChangeSupport)
			if !ok {
				return echo.NewHTTPError(http.StatusNotImplemented, "password change support not available")
			}

			username := c.Param("username")
			var req struct {
				Password string `json:"password"`
			}
			if err := c.Bind(&req); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}
			if err := changer.SetUserPassword(ctx, username, req.Password, "bcrypt"); err != nil {
				return err
			}
			c.NoContent(http.StatusNoContent)

			return nil
		},
	)

	r.PUT(
		"v1/users/:username/roles/:rolename",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			manager, err := getManager(app)
			if err != nil {
				return err
			}

			username := c.Param("username")
			rolename := c.Param("rolename")

			if err := manager.AssignUserRole(ctx, username, rolename); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)

	r.DELETE(
		"v1/users/:username/roles/:rolename",
		permission.OneOf{ManageUserAction},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			manager, err := getManager(app)
			if err != nil {
				return err
			}

			username := c.Param("username")
			rolename := c.Param("rolename")

			if err := manager.UnassignUserRole(ctx, username, rolename); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)
}
