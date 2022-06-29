package wikiapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	GetCollectionEndpoint(router)
	ListCollectionEndpoint(router)
	CreateCollectionEndpoint(router)
	UpdateCollectionEndpoint(router)
	DeleteCollectionEndpoint(router)

	SearchDocumentsEndpont(router)
	GetRecentlyUpdatedDocumentsEndpoint(router)
	GetDocumentEndpoint(router)
	CreateDocumentEndpoint(router)
	UpdateDocumentEndpoint(router)
	DeleteDocumentEndpoint(router)
}
