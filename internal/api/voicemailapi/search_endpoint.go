package voicemailapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// SearchEndpoint allows loading voicemail records for a given date.
func SearchEndpoint(router *app.Router) {
	router.GET(
		"v1/search",
		permission.OneOf{
			ReadVoicemailsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			opts := new(voicemaildb.SearchOptions)

			if name := c.Query("name"); name != "" {
				opts.ByVoiceMail(name)
			}

			if date := c.Query("date"); date != "" {
				d, err := app.ParseTime("2006-1-2", date)
				if err != nil {
					return httperr.InvalidParameter("date")
				}
				opts.ByDate(d)
			}

			if seen := c.Query("seen"); seen != "" {
				b, err := strconv.ParseBool(seen)
				if err != nil {
					return httperr.BadRequest(err)
				}

				opts.BySeen(b)
			}

			records, err := app.VoiceMails.Search(ctx, opts)
			if err != nil {
				return httperr.InternalError(err)
			}

			c.JSON(http.StatusOK, records)

			return nil
		},
	)
}
