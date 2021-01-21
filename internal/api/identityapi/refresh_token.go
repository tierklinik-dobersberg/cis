package identityapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/session"
)

// RefreshEndpoint isues a new access token for the active
// session if a valid token with refresh-scope is given.
func RefreshEndpoint(grp gin.IRouter) {
	// We don't use session.Require() here as that
	// requires an access-scoped token. We only need
	// a "refresh" scope one here.
	grp.POST(
		"v1/refresh",
		func(c *gin.Context) {
			app := app.From(c)
			if app == nil {
				return
			}

			token, err := session.IssueAccessToken(app, c)
			if err != nil {
				httperr.Abort(c, err)
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"token": token,
			})
		},
	)
}
