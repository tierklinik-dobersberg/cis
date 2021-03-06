package identityapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// LogoutEndpoint clears the session cookie. It does not invalidate
// the token!
func LogoutEndpoint(grp *app.Router) {
	grp.POST(
		"v1/logout",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			if session.Get(c) == nil {
				c.Status(http.StatusNoContent)
				return nil
			}

			if err := app.Sessions.Delete(c); err != nil {
				log.From(ctx).Errorf("failed to delete session: %s", err)
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
