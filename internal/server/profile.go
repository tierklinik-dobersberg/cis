package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (srv *Server) requireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := srv.SessionUser(c)
		if user == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		c.Next()
	}
}
