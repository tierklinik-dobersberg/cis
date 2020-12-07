package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (srv *Server) requireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := srv.getUser(c)
		if user == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		c.Next()
	}
}

// profileEndpoints returns the profile of the user.
func (srv *Server) profileEndpoint(c *gin.Context) {
	userName := srv.getUser(c)

	user, err := srv.DB.GetUser(c.Request.Context(), userName)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, user.User)
}
