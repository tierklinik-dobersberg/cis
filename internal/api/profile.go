package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/userhub/internal/server"
)

// ProfileEndpoint
//
// GET /api/v1/profile
func ProfileEndpoint(srv *server.Server, grp gin.IRouter) {
	grp.GET("v1/profile", func(c *gin.Context) {
		userName := srv.SessionUser(c)

		user, err := srv.DB.GetUser(c.Request.Context(), userName)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		c.JSON(http.StatusOK, user.User)
	})
}
