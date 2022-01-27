package identityapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// RefreshEndpoint isues a new access token for the active
// session if a valid token with refresh-scope is given.
func RefreshEndpoint(grp *app.Router) {
	// We don't use session.Require() here as that
	// requires an access-scoped token. We only need
	// a "refresh" scope one here.
	grp.POST(
		"v1/refresh",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			token, err := app.Sessions.IssueAccessToken(c)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, gin.H{
				"token": token,
			})
			return nil
		},
		// session.Require() is not required here as IssueAccessToken() will
		// verify the refresh-token while the access-token is allowed to have
		// been expired.
	)
}
