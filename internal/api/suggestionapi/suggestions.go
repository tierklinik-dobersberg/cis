package suggestionapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/tasks/linkable"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

type Suggestion struct {
	ID   string      `json:"id"`
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func GetSuggestionsEndpoint(r *app.Router) {
	r.GET(
		"v1/suggestions",
		permission.Union{
			ReadSuggestionsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			ls := c.Query("limit")
			var (
				limit int64
				err   error
			)
			if ls != "" {
				limit, err = strconv.ParseInt(ls, 10, 0)
				if err != nil {
					return httperr.InvalidParameter("limit", err.Error())
				}
			}
			keys, err := app.Cache.List(ctx, linkable.CachePrefix)
			if err != nil {
				return err
			}

			var suggestions []Suggestion
			for _, k := range keys {
				blob, _, err := app.Cache.Read(ctx, k)
				if err != nil {
					if errors.Is(err, cache.ErrNotFound) {
						continue
					}
					return err
				}

				var s linkable.Suggestion
				if err := json.Unmarshal(blob, &s); err != nil {
					return err
				}

				// skip false-positives here as the user already marked
				// them as not-applicable.
				if s.FalsePositive {
					continue
				}
				suggestions = append(suggestions, Suggestion{
					ID:   base64.RawStdEncoding.EncodeToString([]byte(k)),
					Type: "customer-link",
					Data: s,
				})

				if len(suggestions) >= int(limit) && limit > 0 {
					break
				}
			}

			c.JSON(http.StatusOK, suggestions)
			return nil
		},
	)
}

func ApplySuggestionEndpoint(r *app.Router) {
	r.POST(
		"v1/suggestions/:type",
		permission.Union{
			ApplySuggestionsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			sugType := c.Param("type")

			if sugType == "customer-link" {
				var payload linkable.Suggestion
				if err := json.NewDecoder(c.Request.Body).Decode(&payload); err != nil {
					return err
				}
				if err := linkable.LinkCustomers(ctx, app, payload); err != nil {
					return err
				}
				return nil
			}
			return httperr.BadRequest(nil, "unknown suggestion type")
		},
	)
}

func DeleteSuggestionEndpoint(r *app.Router) {
	r.DELETE(
		"v1/suggestions/:id",
		permission.Union{
			ApplySuggestionsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			shouldDelete := c.Request.URL.Query().Has("delete")
			b64id := c.Param("id")
			id, err := base64.RawStdEncoding.DecodeString(b64id)
			if err != nil {
				return httperr.InvalidParameter("id", err.Error())
			}

			if shouldDelete {
				if err := linkable.DeleteSuggestion(ctx, app, string(id)); err != nil {
					return err
				}
			} else {
				if err := linkable.MarkFalsePositive(ctx, app, string(id)); err != nil {
					return err
				}
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
