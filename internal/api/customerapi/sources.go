package customerapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func ListSourcesEndpoint(r *app.Router) {
	r.GET(
		"sources/v1",
		permission.OneOf{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			// TODO(ppacher): should we make the DefaultSourceManager available
			// via app?

			sources := customerdb.DefaultSourceManager.ListSources()

			type model struct {
				Name           string                 `json:"name"`
				Description    string                 `json:"description,omitempty"`
				Metadata       map[string]interface{} `json:"metadata,omitempty"`
				SupportsDelete bool                   `json:"supportsDelete"`
				SupportsUpdate bool                   `json:"supportsUpdate"`
				SupportsCreate bool                   `json:"supportsCreate"`
			}

			var res []model
			for _, s := range sources {
				res = append(res, model{
					Name:           s.Name,
					Description:    s.Description,
					Metadata:       s.Metadata,
					SupportsDelete: s.DeleteFunc != nil,
					SupportsUpdate: s.UpdateFunc != nil,
					SupportsCreate: s.CreateFunc != nil,
				})
			}

			c.JSON(http.StatusOK, res)

			return nil
		},
	)
}
