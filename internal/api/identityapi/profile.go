package identityapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// ProfileEndpoint serves the user profile of the user
// currently logged in.
func ProfileEndpoint(grp *app.Router) {
	grp.GET(
		"v1/profile",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			sess := session.Get(c)

			ctx = identity.WithScope(ctx, identity.Private)
			user, err := app.Identities.GetUser(ctx, sess.User.Name)
			if err != nil {
				return err
			}

			// the user/request might be granted roles by auto-assignment (see autologin)
			// so make sure we send the complete set of available roles here,
			user.User.Roles = sess.DistinctRoles()

			return c.JSON(http.StatusOK, user.User)
		},
		session.Require(),
	)
}
