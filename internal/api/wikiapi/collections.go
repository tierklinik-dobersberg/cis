package wikiapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/wiki"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func GetCollectionEndpoint(router *app.Router) {
	router.GET(
		"v1/collections/:name",
		permission.OneOf{
			ActionReadCollections,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			collName := c.Param("name")

			col, err := app.Wiki.GetCollection(ctx, collName)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"collection": col,
			})
		},
	)
}

func ListCollectionEndpoint(router *app.Router) {
	router.GET(
		"v1/collections/",
		permission.OneOf{
			ActionReadCollections,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			cols, err := app.Wiki.ListCollections(ctx)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"collections": cols,
			})
		},
	)
}

func CreateCollectionEndpoint(router *app.Router) {
	router.POST(
		"v1/collections/",
		permission.OneOf{
			ActionWriteCollections,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return updateCollection(ctx, c, app, true)
		},
	)
}

func UpdateCollectionEndpoint(router *app.Router) {
	router.PUT(
		"v1/collections/:name",
		permission.OneOf{
			ActionWriteCollections,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return updateCollection(ctx, c, app, false)
		},
	)
}

func DeleteCollectionEndpoint(router *app.Router) {
	router.DELETE(
		"v1/collections/:name",
		permission.OneOf{
			ActionWriteCollections,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			name := c.Param("name")
			migrateDocumentsTo := c.QueryParam("migrate-to")

			if err := app.Wiki.DeleteCollection(ctx, name, migrateDocumentsTo); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}

func updateCollection(ctx context.Context, c echo.Context, app *app.App, create bool) error {
	collName := ""
	if !create {
		collName = c.Param("name")
	}

	var col wiki.Collection
	if err := c.Bind(&col); err != nil {
		return err
	}

	var err error
	if create {
		err = app.Wiki.CreateCollection(ctx, col.Name, col.Description, col.ImageURL)
	} else {
		if collName != col.Name && col.Name != "" {
			return httperr.BadRequest("collection name cannot be changed")
		}

		err = app.Wiki.UpdateCollection(ctx, collName, col.Description, col.ImageURL)
	}

	if err != nil {
		return err
	}

	return c.NoContent(http.StatusNoContent)
}
