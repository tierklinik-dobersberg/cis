package identityapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/service/server"
)

// ListAllUsersEndpoint returns all users registered at cisd.
func ListAllUsersEndpoint(grp gin.IRouter) {
	grp.GET("v1/users", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		all, err := app.Identities.ListAllUsers(c.Request.Context())
		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		// TODO(ppacher): privacy settings based on user role!
		result := make([]v1alpha.User, len(all))
		for idx, u := range all {
			result[idx] = u.User
		}

		c.JSON(http.StatusOK, result)
	})
}
