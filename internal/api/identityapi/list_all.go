package identityapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// ListAllUsersEndpoint returns all users registered at cisd.
func ListAllUsersEndpoint(grp *app.Router) {
	grp.GET(
		"v1/users",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			all, err := app.Identities.ListAllUsers(ctx)
			if err != nil {
				return err
			}

			// TODO(ppacher): privacy settings based on user role!
			result := make([]v1alpha.User, len(all))
			for idx, u := range all {
				result[idx] = u.User
			}

			c.JSON(http.StatusOK, result)
			return nil
		},
	)
}
