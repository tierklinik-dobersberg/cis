package infoscreenapi

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

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

func UploadFileEndpoint(router *app.Router) {
	router.POST(
		"v1/upload/:layout/:varName",
		permission.OneOf{
			ActionUploadFiles,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			// We only expect and hanlde multipart/form-data here
			contentType := c.Request.Header.Get("content-type")
			if !strings.Contains(contentType, "multipart/form-data") {
				return httperr.UnsupportedMediaType("only multipart/form-data is supported")
			}

			// try to parse the multipart form and limit the whole request body
			// to MaxUploadSize=
			if err := c.Request.ParseMultipartForm(app.MaxUploadSize()); err != nil {
				if errors.Is(err, multipart.ErrMessageTooLarge) {
					return httperr.RequestToLarge("maximum size is %s", app.Config.InfoScreenConfig.MaxUploadSize)
				}
				logger.From(ctx).Errorf("failed to process upload request: %s", err)
				return httperr.InternalError(nil, "failed to process request")
			}

			// we only accept one file-upload per request
			var file *multipart.FileHeader
			if len(c.Request.MultipartForm.File) > 1 {
				return httperr.BadRequest(nil, "only one file-upload is allowed per request")
			}
			for _, files := range c.Request.MultipartForm.File {
				if len(files) > 1 {
					return httperr.BadRequest(nil, "only one file-upload is allowed per request")
				}
				file = files[0]
			}

			// make sure we actually have a multipart file-header
			if file == nil {
				return httperr.BadRequest(nil, "no file disposition found")
			}

			// search for the layout and the variable definition so we can
			// make sure the variable actually requires a file upload.
			layoutName := c.Param("layout")
			varName := c.Param("varName")

			l, err := app.LayoutStore.Get(ctx, layoutName)
			if err != nil {
				return err
			}

			def := l.Var(varName)
			if def == nil {
				return httperr.NotFound("variable", varName, nil)
			}
			if !layouts.RequiresUpload(def.Type) {
				return httperr.BadRequest(fmt.Errorf("variable %s does not accept uploads", def.Name))
			}

			// make sure the uploaded file type is actually allowed for the variable.
			if err := isAllowedFile(def, file, app.MaxUploadSize()); err != nil {
				return err
			}

			fname, err := saveUploadedFile(app, layoutName, varName, file)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, gin.H{
				"filename": fname,
			})

			return nil
		},
	)
}

func saveUploadedFile(app *app.App, layoutName, varName string, file *multipart.FileHeader) (string, error) {
	// make sure the directory actually exists
	if err := os.MkdirAll(app.Config.InfoScreenConfig.UploadDataDirectory, 0755); err != nil {
		return "", err
	}

	// actually perform the upload
	f, err := file.Open()
	if err != nil {
		return "", err
	}
	defer f.Close()

	ext := filepath.Ext(file.Filename)
	fname := fmt.Sprintf("%s-%s-%d%s", layoutName, varName, time.Now().Unix(), ext)
	fpath := filepath.Join(
		app.Config.InfoScreenConfig.UploadDataDirectory,
		fname,
	)

	uploadedFile, err := os.Create(fpath)
	if err != nil {
		return "", err
	}
	defer uploadedFile.Close()

	if _, err := io.Copy(uploadedFile, f); err != nil {
		return "", err
	}
	return fname, nil
}

func isAllowedFile(varDef *layouts.Variable, file *multipart.FileHeader, maxSize int64) error {
	// try to guess the mime-type by filename extension
	if ext := filepath.Ext(file.Filename); ext != "" {
		mt := mime.TypeByExtension(ext)
		if mt != "" && !isAllowedMediaType(varDef, mt) {
			return httperr.BadRequest(nil, "media type is not allowed")
		}
	}

	// verify the mime-type of the Content-Type file header
	ct := file.Header.Get("Content-Type")
	if ct == "" {
		return httperr.BadRequest(nil, "missing content-type header in file disposition")
	}

	parsed, _, err := mime.ParseMediaType(ct)
	if err != nil {
		return httperr.BadRequest(err, "invalid content-type header in file disposition")
	}
	if !isAllowedMediaType(varDef, parsed) {
		return httperr.BadRequest(nil, "media type is not allowed")
	}

	if file.Size > maxSize {
		return httperr.RequestToLarge("maximum allowed file size exceeded")
	}

	return nil
}

func isAllowedMediaType(varDef *layouts.Variable, mt string) bool {
	switch varDef.Type {
	case layouts.TypeImage:
		return strings.HasPrefix(mt, "image/")
	case layouts.TypeVideo:
		return strings.HasPrefix(mt, "video/")
	}

	return false
}
