package identityapi

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// AvatarEndpoint serves the user avatar as an image.
func AvatarEndpoint(grp *app.Router) {
	grp.GET(
		"v1/avatar/:userName",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			log := log.From(ctx)
			userName := c.Param("userName")
			if userName == "" {
				return httperr.BadRequest("missing username parameter")
			}

			// We need scope Internal so we get the avatar file name.
			ctx = identitydb.WithScope(ctx, identitydb.Internal)

			// load the user data using the prepared context
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
					return httperr.NotFound("avatar", avatarFile)
				}

				return err
			}

			if closer, ok := f.(io.Closer); ok {
				defer closer.Close()
			}

			http.ServeContent(c.Response(), c.Request(), userName, time.Now(), f)
			return nil
		},
		session.Require(),
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
