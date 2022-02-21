package identityapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// ListAllUsersEndpoint returns all users registered at cisd.
func ListAllUsersEndpoint(grp *app.Router) {
	grp.GET(
		"v1/users",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			all, err := app.Identities.ListAllUsers(ctx)
			if err != nil {
				return err
			}

			// TODO(ppacher): privacy settings based on user role!
			result := make([]v1alpha.User, len(all))
			for idx, u := range all {
				result[idx] = u.User
			}

			return c.JSON(http.StatusOK, result)
		},
		session.Require(),
	)
}
