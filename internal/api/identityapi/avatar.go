package identityapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/api/utils"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
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
			ctx = identity.WithScope(ctx, identity.Internal)

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

	grp.POST(
		"v1/avatar/:userName",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			username := c.Param("userName")
			sess := session.Get(c)

			// the user can change it's own avatar but if this is a different
			// user it needs to have the ManageUserActin permission
			if username != sess.User.Name {
				allowed, err := app.Matcher.Decide(ctx, &permission.Request{
					User:   sess.User.Name,
					Action: ManageUserAction.Name,
				}, sess.ExtraRoles())
				if err != nil {
					return err
				}

				if !allowed {
					return httperr.Forbidden().
						SetInternal(fmt.Errorf("user %s is not allowed to change avatar of user %s", sess.User.Name, username))
				}
			}

			ctx = identity.WithScope(ctx, identity.Internal)
			user, err := app.Identities.GetUser(ctx, username)
			if err != nil {
				return err
			}

			// We only expect and hanlde multipart/form-data here
			contentType := c.Request().Header.Get("content-type")
			if !strings.Contains(contentType, "multipart/form-data") {
				return httperr.UnsupportedMediaType("only multipart/form-data is supported")
			}

			// try to parse the multipart form and limit the whole request body
			// to MaxUploadSize=
			if err := c.Request().ParseMultipartForm(app.MaxUploadSize()); err != nil {
				if errors.Is(err, multipart.ErrMessageTooLarge) {
					return httperr.RequestToLarge("maximum size is %s", app.Config.InfoScreenConfig.MaxUploadSize)
				}
				logger.From(ctx).Errorf("failed to process upload request: %s", err)
				return httperr.InternalError("failed to process request")
			}

			// we only accept one file-upload per request
			var file *multipart.FileHeader
			if len(c.Request().MultipartForm.File) > 1 {
				return httperr.BadRequest("only one file-upload is allowed per request")
			}
			for _, files := range c.Request().MultipartForm.File {
				if len(files) > 1 {
					return httperr.BadRequest("only one file-upload is allowed per request")
				}
				file = files[0]
			}

			// make sure we actually have a multipart file-header
			if file == nil {
				return httperr.BadRequest("no file disposition found")
			}

			// make sure it's an image
			if err := isAllowedFile(file, app.MaxUploadSize()); err != nil {
				return err
			}

			avatarFile := user.AvatarFile
			if avatarFile == "" {
				avatarFile = strings.ToLower(user.Name) + ".png"
			}
			target := filepath.Join(app.Config.AvatarDirectory, avatarFile)
			if err := utils.SaveUploadedFile(file, target); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)

			return nil
		},
	)
}

func isAllowedFile(file *multipart.FileHeader, maxSize int64) error {
	// try to guess the mime-type by filename extension
	if ext := filepath.Ext(file.Filename); ext != "" {
		mt := mime.TypeByExtension(ext)
		if mt != "" && !isAllowedMediaType(mt) {
			return httperr.BadRequest("media type is not allowed")
		}
	}

	// verify the mime-type of the Content-Type file header
	ct := file.Header.Get("Content-Type")
	if ct == "" {
		return httperr.BadRequest("missing content-type header in file disposition")
	}

	parsed, _, err := mime.ParseMediaType(ct)
	if err != nil {
		return httperr.BadRequest("invalid content-type header in file disposition").SetInternal(err)
	}
	if !isAllowedMediaType(parsed) {
		return httperr.BadRequest("media type is not allowed")
	}

	if file.Size > maxSize {
		return httperr.RequestToLarge("maximum allowed file size exceeded")
	}

	return nil
}

func isAllowedMediaType(mt string) bool {
	switch {
	case strings.HasPrefix(mt, "image/"):
		return true
	}
	return false
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
