package identityapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// ProfileEndpoint serves the user profile of the user
// currently logged in.
func ProfileEndpoint(grp gin.IRouter) {
	grp.GET(
		"v1/profile",
		app.RequireSession(),
		func(c *gin.Context) {
			appCtx := app.From(c)
			if appCtx == nil {
				return
			}

			userName := app.SessionUser(c)

			user, err := appCtx.Identities.GetUser(c.Request.Context(), userName)
			if err != nil {
				c.AbortWithError(http.StatusInternalServerError, err)
				return
			}

			// the user/request might be granted roles by auto-assignment (see autologin)
			// so make sure we send the complete set of availabe roles here,
			user.User.Roles = app.SessionRoles(c)

			c.JSON(http.StatusOK, user.User)
		},
	)
}
