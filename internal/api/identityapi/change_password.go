package identityapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// ChangePasswordEndpoint allows a user to change it's own password.
func ChangePasswordEndpoint(grp *app.Router) {
	grp.PUT(
		"v1/profile/password",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			body := struct {
				Current     string `json:"current"`
				NewPassword string `json:"newPassword"`
			}{}

			if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
				return httperr.BadRequest("invalid body").SetInternal(err)
			}

			if body.Current == "" {
				return httperr.MissingField("current")
			}

			if body.NewPassword == "" {
				return httperr.MissingField("newPassword")
			}

			sess := session.Get(c)
			if !app.Identities.Authenticate(ctx, sess.User.Name, body.Current) {
				return httperr.BadRequest()
			}

			changer, ok := app.Identities.(identity.PasswortChangeSupport)
			if !ok {
				return echo.NewHTTPError(http.StatusNotImplemented, "Setting user passwords is not supported in this environment")
			}
			if err := changer.SetUserPassword(ctx, sess.User.Name, body.NewPassword, "bcrypt"); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)
			return nil
		},
		session.Require(),
	)
}
