package api

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/server"
)

// GET /api/v1/avatar/{userName}
func AvatarEndpoint(srv *server.Server, grp gin.IRouter) {
	grp.GET("v1/avatar/:userName", func(c *gin.Context) {
		userName := c.Param("userName")
		if userName == "" {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}

		user, err := srv.DB.GetUser(c.Request.Context(), userName)
		if err != nil {
			logger.From(c.Request.Context()).Errorf("failed to get user %s: %s", userName, err)
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}

		avatarFile := user.AvatarFile
		if avatarFile == "" {
			avatarFile = strings.ToLower(user.Name) + ".png"
		}

		f, err := srv.Loader.LoadAvatar(srv.Config.AvatarDirectory, avatarFile)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		if closer, ok := f.(io.Closer); ok {
			defer closer.Close()
		}

		http.ServeContent(c.Writer, c.Request, userName, time.Now(), f)
	})
}
