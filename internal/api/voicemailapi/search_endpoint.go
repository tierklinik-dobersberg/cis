package voicemailapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// SearchEndpoint allows searching voicemail records by
// the name of the containing mailbox ('name' query parameter),
// the date of the recording ('date' query parameter) and by
// seen/read status ('seen' query parameter).
func SearchEndpoint(router *app.Router) {
	router.GET(
		"v1/search",
		permission.OneOf{
			ReadVoicemailsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			opts := new(voicemaildb.SearchOptions)

			if name := c.QueryParam("name"); name != "" {
				opts.ByVoiceMail(name)
			}

			if date := c.QueryParam("date"); date != "" {
				d, err := app.ParseTime("2006-1-2", date)
				if err != nil {
					return httperr.InvalidParameter("date", err.Error())
				}
				opts.ByDate(d)
			}

			if seen := c.QueryParam("seen"); seen != "" {
				b, err := strconv.ParseBool(seen)
				if err != nil {
					return httperr.BadRequest().SetInternal(err)
				}

				opts.BySeen(b)
			}

			records, err := app.VoiceMails.Search(ctx, opts)
			if err != nil {
				return httperr.InternalError().SetInternal(err)
			}

			return c.JSON(http.StatusOK, records)
		},
	)
}
