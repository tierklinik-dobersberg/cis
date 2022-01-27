package identityapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

type testResult struct {
	Allowed bool   `json:"allowed"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// TestPermissionEndpoint allows testing for permissoins.
func TestPermissionEndpoint(grp *app.Router) {
	grp.POST(
		"v1/permissions/test",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var requests map[string]permission.Request

			if err := json.NewDecoder(c.Request().Body).Decode(&requests); err != nil {
				return httperr.BadRequest("invalid body").SetInternal(err)
			}

			sess := session.Get(c)
			if sess == nil {
				return httperr.InternalError("missing session")
			}

			// test each permission request and record the result
			result := make(map[string]*testResult, len(requests))
			for key, req := range requests {
				// only allow checks for the current session.
				// TODO(ppacher): add special permission to test all users.
				req.User = sess.User.Name

				allowed, err := app.Matcher.Decide(ctx, &req, sess.ExtraRoles())
				result[key] = &testResult{
					Allowed: allowed,
				}
				if err != nil {
					result[key].Error = err.Error()
				}
			}

			c.JSON(http.StatusOK, result)

			return nil
		},
		session.Require(),
	)
}
