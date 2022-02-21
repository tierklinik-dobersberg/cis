package suggestionapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/tasks/linkable"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type Suggestion struct {
	ID   string      `json:"id"`
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// trunk-ignore(golangci-lint/cyclop)
func GetSuggestionsEndpoint(r *app.Router) {
	r.GET(
		"v1/suggestions",
		permission.Union{
			ReadSuggestionsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			ls := c.QueryParam("limit")
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
			for _, key := range keys {
				blob, _, err := app.Cache.Read(ctx, key)
				if err != nil {
					if errors.Is(err, cache.ErrNotFound) {
						continue
					}

					return err
				}

				var suggestion linkable.Suggestion
				if err := json.Unmarshal(blob, &suggestion); err != nil {
					return err
				}

				// skip false-positives here as the user already marked
				// them as not-applicable.
				if suggestion.FalsePositive {
					continue
				}
				suggestions = append(suggestions, Suggestion{
					ID:   base64.RawStdEncoding.EncodeToString([]byte(key)),
					Type: "customer-link",
					Data: suggestion,
				})

				if len(suggestions) >= int(limit) && limit > 0 {
					break
				}
			}

			return c.JSON(http.StatusOK, suggestions)
		},
	)
}

func ApplySuggestionEndpoint(r *app.Router) {
	r.POST(
		"v1/suggestions/:type",
		permission.Union{
			ApplySuggestionsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			sugType := c.Param("type")

			if sugType == "customer-link" {
				var payload linkable.Suggestion
				if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
					return err
				}
				if err := linkable.LinkCustomers(ctx, app, payload); err != nil {
					return err
				}

				return c.NoContent(http.StatusNoContent)
			}

			return httperr.BadRequest("unknown suggestion type")
		},
	)
}

func DeleteSuggestionEndpoint(r *app.Router) {
	r.DELETE(
		"v1/suggestions/:id",
		permission.Union{
			ApplySuggestionsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			shouldDelete := c.QueryParams().Has("delete")
			b64id := c.Param("id")
			suggestionID, err := base64.RawStdEncoding.DecodeString(b64id)
			if err != nil {
				return httperr.InvalidParameter("id", err.Error())
			}

			// for debugging purposes we add the decoded ID to the trace
			trace.SpanFromContext(ctx).SetAttributes(
				attribute.String("tkd.suggestion_id", string(suggestionID)),
			)

			if shouldDelete {
				if err := linkable.DeleteSuggestion(ctx, app, string(suggestionID)); err != nil {
					return fmt.Errorf("failed to delete %s: %w", string(suggestionID), err)
				}
			} else {
				if err := linkable.MarkFalsePositive(ctx, app, string(suggestionID)); err != nil {
					return fmt.Errorf("failed to mark %s as false-positive: %w", string(suggestionID), err)
				}
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
