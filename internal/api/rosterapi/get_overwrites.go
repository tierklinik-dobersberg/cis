package rosterapi

import (
	"context"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
)

// GetOverwritesEndpoint returns all duty-roster overwrites between two specified
// date-times.
func GetOverwritesEndpoint(router *app.Router) {
	router.GET(
		"v1/overwrites",
		permission.OneOf{
			ReadRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			fromStr := c.Query("from")
			toStr := c.Query("to")

			from, err := app.ParseTime(time.RFC3339, fromStr)
			if err != nil {
				return httperr.InvalidParameter("from", err.Error())
			}
			to, err := app.ParseTime(time.RFC3339, toStr)
			if err != nil {
				return httperr.InvalidParameter("to", err.Error())
			}
			_, includeDeleted := c.GetQuery("with-deleted")

			overwrites, err := app.DutyRosters.GetOverwrites(ctx, from, to, includeDeleted)
			if err != nil {
				return err
			}

			sort.Sort(byTime(overwrites))

			c.JSON(http.StatusOK, overwrites)
			return nil
		},
	)
}

type byTime []*v1alpha.Overwrite

func (sl byTime) Less(i, j int) bool { return sl[i].From.Before(sl[j].From) }
func (sl byTime) Swap(i, j int)      { sl[i], sl[j] = sl[j], sl[i] }
func (sl byTime) Len() int           { return len(sl) }
