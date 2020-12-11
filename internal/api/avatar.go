package api

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/app"
)

// AvatarEndpoint serves the user avatar as an image.
//
// GET /api/v1/avatar/{userName}
func AvatarEndpoint(grp gin.IRouter) {
	grp.GET(
		"v1/avatar/:userName",
		app.RequireSession(),
		func(c *gin.Context) {
			appCtx := app.From(c)
			if appCtx == nil {
				return
			}

			userName := c.Param("userName")
			if userName == "" {
				c.AbortWithStatus(http.StatusBadRequest)
				return
			}

			user, err := appCtx.DB.GetUser(c.Request.Context(), userName)
			if err != nil {
				logger.From(c.Request.Context()).Errorf("failed to get user %s: %s", userName, err)
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}

			avatarFile := user.AvatarFile
			if avatarFile == "" {
				avatarFile = strings.ToLower(user.Name) + ".png"
			}

			f, err := appCtx.Loader.LoadAvatar(appCtx.Config.AvatarDirectory, avatarFile)
			if err != nil {
				c.AbortWithError(http.StatusInternalServerError, err)
				return
			}

			if closer, ok := f.(io.Closer); ok {
				defer closer.Close()
			}

			http.ServeContent(c.Writer, c.Request, userName, time.Now(), f)
		},
	)
}
