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
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// AvatarEndpoint serves the user avatar as an image.
func AvatarEndpoint(grp *app.Router) {
	grp.GET(
		"v1/avatar/:userName",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			log := log.From(ctx)
			userName := c.Param("userName")
			if userName == "" {
				return httperr.BadRequest(nil, "missing username parameter")
			}

			user, err := app.Identities.GetUser(ctx, userName)
			if err != nil {
				log.Errorf("failed to get user %s: %s", userName, err)
				return err
			}

			avatarFile := user.AvatarFile
			if avatarFile == "" {
				avatarFile = strings.ToLower(user.Name) + ".png"
			}

			f, err := loadAvatar(ctx, app.Config.AvatarDirectory, avatarFile)
			if err != nil {
				if os.IsNotExist(err) {
					return httperr.NotFound("avatar", userName, err)
				}

				return err
			}

			if closer, ok := f.(io.Closer); ok {
				defer closer.Close()
			}

			http.ServeContent(c.Writer, c.Request, userName, time.Now(), f)
			return nil
		},
	)
}

func loadAvatar(ctx context.Context, path string, fileName string) (io.ReadSeeker, error) {
	filePath := filepath.Clean(filepath.Join(path, fileName))

	log.From(ctx).Infof("Loading avatar from %s", filePath)

	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	return f, nil
}
