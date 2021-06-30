package identityapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// ProfileEndpoint serves the user profile of the user
// currently logged in.
func ProfileEndpoint(grp *app.Router) {
	grp.GET(
		"v1/profile",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			sess := session.Get(c)

			ctx = identitydb.WithScope(ctx, identitydb.Private)
			user, err := app.Identities.GetUser(ctx, sess.User.Name)
			if err != nil {
				return err
			}

			// the user/request might be granted roles by auto-assignment (see autologin)
			// so make sure we send the complete set of availabe roles here,
			user.User.Roles = sess.DistinctRoles()

			c.JSON(http.StatusOK, user.User)
			return nil
		},
	)
}
