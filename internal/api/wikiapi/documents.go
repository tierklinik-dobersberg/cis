package wikiapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/wiki"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
)

type (
	SearchDocumentRequest struct {
		SearchTerm string `json:"search"`
	}

	SearchDocumentResponse struct {
		Results []wiki.Document `json:"results"`
	}

	RecentlyUpdatedDocumentResponse struct {
		Result []wiki.Document `json:"results"`
	}

	CreateDocumentPayload struct {
		Content     string   `json:"content"`
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Tags        []string `json:"tags"`
		Owner       string   `json:"owner"`
	}

	UpdateDocumentPayload struct {
		Content     *string   `json:"content,omitempty"`
		Title       *string   `json:"title,omitempty"`
		Description *string   `json:"description,omitempty"`
		Tags        *[]string `json:"tags,omitempty"`
		Owner       *string   `json:"owner,omitempty"`
		Path        *string   `json:"path,omitempty"`
		Collection  *string   `json:"collection,omitempty"`
	}

	DocumentResponse struct {
		Document  *wiki.Document  `json:"document"`
		Children  []wiki.Document `json:"children"`
		Backlinks []wiki.Backlink `json:"backlinks"`
	}
)

func SearchDocumentsEndpont(r *app.Router) {
	r.POST(
		"v1/search",
		permission.OneOf{
			ActionDocumentRead,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var req SearchDocumentRequest
			if err := c.Bind(&req); err != nil {
				return err
			}

			res, err := app.Wiki.SearchDocuments(ctx, req.SearchTerm)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, SearchDocumentResponse{
				Results: res,
			})
		},
	)
}

func GetRecentlyUpdatedDocumentsEndpoint(r *app.Router) {
	r.GET(
		"v1/recently-updated",
		permission.OneOf{
			ActionDocumentRead,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			res, err := app.Wiki.FindRecentlyUpdated(ctx, 20)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, RecentlyUpdatedDocumentResponse{
				Result: res,
			})
		},
	)
}

func GetDocumentEndpoint(r *app.Router) {
	r.GET(
		"v1/collections/:name/*",
		permission.OneOf{
			ActionDocumentRead,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			colName := c.Param("name")
			docPath := "/" + c.Param("*")
			exclude := c.QueryParams()["exclude"]

			var (
				doc               *wiki.Document
				childs            []wiki.Document
				backlinks         []wiki.Backlink
				excludeDocument   bool
				excludeChildren   bool
				excludeBacklinks  bool
				recursiveChildren bool
			)

			for _, e := range exclude {
				switch e {
				case "document", "doc":
					excludeDocument = true
				case "children", "list":
					excludeChildren = true
				case "backlinks":
					excludeBacklinks = true
				default:
					return httperr.InvalidParameter("exclude", e)
				}
			}

			if c.QueryParams().Has("recursive") {
				recursiveChildren = true
			}

			if !excludeDocument {
				var err error
				doc, err = app.Wiki.LoadDocument(ctx, colName, docPath)
				if err != nil {
					var httpErr *echo.HTTPError
					if !errors.As(err, &httpErr) || httpErr.Code != 404 {
						return err
					}
				}
			}

			if !excludeChildren {
				var err error
				childs, err = app.Wiki.ListDocuments(ctx, colName, docPath, recursiveChildren)
				if err != nil {
					return err
				}
			}

			if !excludeBacklinks {
				var err error
				backlinks, err = app.Wiki.FindBacklinks(ctx, colName, docPath)
				if err != nil {
					logger.From(ctx).Errorf("failed to find backlinks: %s", err.Error())
				}
			}

			return c.JSON(http.StatusOK, DocumentResponse{
				Document:  doc,
				Children:  childs,
				Backlinks: backlinks,
			})
		},
	)
}

func CreateDocumentEndpoint(r *app.Router) {
	r.POST(
		"v1/collections/:name/*",
		permission.OneOf{
			ActionDocumentWrite,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var body CreateDocumentPayload

			if err := c.Bind(&body); err != nil {
				return err
			}

			sess := session.Get(c)

			owner := body.Owner
			if owner == "" {
				owner = sess.User.Name
			}

			doc := wiki.Document{
				Collection:  c.Param("name"),
				Path:        "/" + c.Param("*"),
				Title:       body.Title,
				Description: body.Description,
				Content:     body.Content,
				Metadata: wiki.Metadata{
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
					CreatedBy: sess.User.Name,
					UpdatedBy: sess.User.Name,
					Tags:      body.Tags,
					Owner:     owner,
				},
			}

			if err := wiki.AnalyzeContent(doc.Collection, doc.Content, &doc.Metadata.Content); err != nil {
				return httperr.InternalError("failed to analyze content").SetInternal(err)
			}

			if err := app.Wiki.CreateDocument(ctx, doc); err != nil {
				return httperr.InternalError("failed to create document at path " + doc.Path).SetInternal(err)
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}

func UpdateDocumentEndpoint(router *app.Router) {
	router.PUT(
		"v1/collections/:name/*",
		permission.OneOf{
			ActionDocumentWrite,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			colName := c.Param("name")
			docPath := "/" + c.Param("*")

			var updates []wiki.UpdateOperation
			add := func(op wiki.UpdateOperation) {
				updates = append(updates, op)
			}

			var req UpdateDocumentPayload
			if err := c.Bind(&req); err != nil {
				return httperr.BadRequest(err.Error()).SetInternal(err)
			}

			if req.Collection != nil {
				add(wiki.WithUpdateCollection(*req.Collection))
			}

			if req.Content != nil {
				// FIXME(ppacher): use new colName in case req.Collection is set?
				add(wiki.WithUpdateContent(colName, *req.Content))
			}

			if req.Description != nil {
				add(wiki.WithUpdateDescription(*req.Description))
			}

			if req.Owner != nil {
				add(wiki.WithUpdateOwner(*req.Owner))
			}

			if req.Tags != nil {
				add(wiki.WithUpdateTags(*req.Tags))
			}

			if req.Title != nil {
				add(wiki.WithUpdateTitle(*req.Title))
			}

			if req.Path != nil {
				add(wiki.WithUpdatePath(*req.Path))
			}

			user := session.UserFromCtx(ctx)
			if err := app.Wiki.UpdateDocument(ctx, colName, docPath, user, updates...); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}

func DeleteDocumentEndpoint(router *app.Router) {
	router.DELETE(
		"v1/collections/:name/*",
		permission.OneOf{
			ActionDocumentWrite,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			colName := c.Param("name")
			docPath := "/" + c.Param("*")

			if err := app.Wiki.DeleteDocument(ctx, colName, docPath); err != nil {
				return httperr.InternalError("failed to delete document").SetInternal(err)
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
