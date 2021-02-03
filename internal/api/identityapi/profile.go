package identityapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/session"
)

// ProfileEndpoint serves the user profile of the user
// currently logged in.
func ProfileEndpoint(grp gin.IRouter) {
	grp.GET(
		"v1/profile",
		session.Require(),
		func(c *gin.Context) {
			app := app.From(c)
			if app == nil {
				return
			}

			sess := session.Get(c)

			ctx := identitydb.WithScope(c.Request.Context(), identitydb.Private)
			user, err := app.Identities.GetUser(ctx, sess.User.Name)
			if err != nil {
				httperr.InternalError(err).AbortRequest(c)
				return
			}

			// the user/request might be granted roles by auto-assignment (see autologin)
			// so make sure we send the complete set of availabe roles here,
			user.Roles = sess.Roles

			c.JSON(http.StatusOK, user)
		},
	)
}
