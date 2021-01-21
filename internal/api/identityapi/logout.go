package identityapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/session"
)

// LogoutEndpoint clears the session cookie. It does not invalidate
// the token!
func LogoutEndpoint(grp gin.IRouter) {
	grp.POST("v1/logout", func(c *gin.Context) {
		appCtx := app.From(c)
		if appCtx == nil {
			return
		}

		if session.Get(c) == nil {
			c.Status(http.StatusOK)
			return
		}

		session.Delete(appCtx, c)

		c.Status(http.StatusOK)
	})
}
