package identityapi

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/logger"
)

// AvatarEndpoint serves the user avatar as an image.
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

			user, err := appCtx.Identities.GetUser(c.Request.Context(), userName)
			if err != nil {
				logger.From(c.Request.Context()).Errorf("failed to get user %s: %s", userName, err)
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}

			avatarFile := user.AvatarFile
			if avatarFile == "" {
				avatarFile = strings.ToLower(user.Name) + ".png"
			}

			f, err := loadAvatar(c.Request.Context(), appCtx.Config.AvatarDirectory, avatarFile)
			if err != nil {
				if os.IsNotExist(err) {
					c.AbortWithStatus(http.StatusNotFound)
					return
				}

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

func loadAvatar(ctx context.Context, path string, fileName string) (io.ReadSeeker, error) {
	filePath := filepath.Clean(filepath.Join(path, fileName))

	logger.Infof(ctx, "Loading avatar from %s", filePath)

	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	return f, nil
}
