package importapi

import (
	"context"
	"io/ioutil"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ImportNeumayrContactsEndpoint(grp *app.Router) {
	grp.POST(
		"v1/neumayr/contacts",
		permission.Set{
			NeumayrContactsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			file, err := c.FormFile("file")
			if err != nil {
				return httperr.BadRequest(err)
			}

			tmpFile, err := ioutil.TempFile("", "upload-*.mdb")
			if err != nil {
				return httperr.InternalError(err)
			}
			tmpFile.Close()
			defer os.Remove(tmpFile.Name())

			if err := c.SaveUploadedFile(file, tmpFile.Name()); err != nil {
				return httperr.InternalError(err)
			}

			f, err := os.Open(tmpFile.Name())
			if err != nil {
				return httperr.InternalError(err)
			}
			defer f.Close()

			importer := neumayr.NewImporter(app)

			countNew, countUpdated, countUnchanged, err := importer.Import(ctx, f)
			if err != nil {
				return httperr.InternalError(err)
			}

			c.JSON(http.StatusOK, gin.H{
				"new":       countNew,
				"updated":   countUpdated,
				"unchanged": countUnchanged,
			})

			return nil
		},
	)
}
