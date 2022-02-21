package calllogapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/calllogdb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
	customerv1alpha "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
)

type SearchResult struct {
	Items []v1alpha.CallLog `json:"items"`
}

func SearchEndpoint(router *app.Router) {
	router.GET(
		"v1/search",
		permission.OneOf{
			ReadRecordsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			query := new(calllogdb.SearchQuery)

			if d, err := getQueryDate(c, app, "at"); !d.IsZero() {
				query.AtDate(d)
			} else if err != nil {
				return err
			}

			if d, err := getQueryDate(c, app, "to"); !d.IsZero() {
				query.Before(d)
			} else if err != nil {
				return err
			}

			if d, err := getQueryDate(c, app, "from"); !d.IsZero() {
				query.After(d)
			} else if err != nil {
				return err
			}

			if cid := c.QueryParam("cid"); cid != "" {
				ref := customerv1alpha.ParseRef(cid)
				if ref == nil {
					return httperr.InvalidParameter("cid")
				}

				query.Customer(ref.Source, ref.CustomerID)
			}

			results, err := app.CallLogs.Search(ctx, query)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, SearchResult{Items: results})
		},
	)
}

func getQueryDate(c echo.Context, app *app.App, param string) (time.Time, error) {
	val := c.QueryParam(param)
	if val == "" {
		return time.Time{}, nil
	}
	d, err := app.ParseTime(time.RFC3339, val)
	if err != nil {
		return time.Time{}, httperr.InvalidParameter(param)
	}

	return d, nil
}
