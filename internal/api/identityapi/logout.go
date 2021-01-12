package identityapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// LogoutEndpoint clears the session cookie. It does not invalidate
// the token!
func LogoutEndpoint(grp gin.IRouter) {
	grp.POST("v1/logout", func(c *gin.Context) {
		appCtx := app.From(c)
		if appCtx == nil {
			return
		}

		if app.SessionUser(c) == "" {
			c.Status(http.StatusOK)
			return
		}

		cookie := app.ClearSessionCookie(appCtx)
		http.SetCookie(c.Writer, cookie)

		c.Status(http.StatusOK)
	})
}
