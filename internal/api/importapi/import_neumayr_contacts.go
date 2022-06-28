package importapi

import (
	"context"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func ImportNeumayrContactsEndpoint(grp *app.Router) {
	grp.POST(
		"v1/neumayr/contacts",
		permission.OneOf{
			NeumayrContactsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			file, err := c.FormFile("file")
			if err != nil {
				return httperr.MissingField("file")
			}

			tmpFile, err := ioutil.TempFile("", "upload-*.mdb")
			if err != nil {
				return httperr.InternalError().SetInternal(err)
			}
			tmpFile.Close()
			defer os.Remove(tmpFile.Name())

			if err := SaveUploadedFile(file, tmpFile.Name()); err != nil {
				return httperr.InternalError().SetInternal(err)
			}

			f, err := os.Open(tmpFile.Name())
			if err != nil {
				return httperr.InternalError().SetInternal(err)
			}
			defer f.Close()

			importer := neumayr.NewImporter(app.Config.Country, app.Customers)

			countNew, countUpdated, countUnchanged, err := importer.Import(ctx, f)
			if err != nil {
				return httperr.InternalError().SetInternal(err)
			}

			return c.JSON(http.StatusOK, gin.H{
				"new":       countNew,
				"updated":   countUpdated,
				"unchanged": countUnchanged,
			})
		},
	)
}

func SaveUploadedFile(file *multipart.FileHeader, dst string) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, src)

	return err
}
