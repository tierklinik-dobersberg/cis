package identityapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/session"
	"github.com/tierklinik-dobersberg/logger"
)

// LogoutEndpoint clears the session cookie. It does not invalidate
// the token!
func LogoutEndpoint(grp *app.Router) {
	grp.POST(
		"v1/logout",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			if session.Get(c) == nil {
				c.Status(http.StatusOK)
				return nil
			}

			if err := session.Delete(app, c); err != nil {
				logger.From(ctx).Errorf("failed to delete session: %s", err)
			}

			c.Status(http.StatusOK)
			return nil
		},
	)
}
