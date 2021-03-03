package calllogapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/calllogdb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
)

// ForDateEndpoint allows retrieving all calllogs for a given
// date.
func ForDateEndpoint(grp *app.Router) {
	grp.GET(
		"v1/date/:year/:month/:day",
		permission.OneOf{
			ReadRecordsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			year, err := strconv.ParseInt(c.Param("year"), 10, 0)
			if err != nil {
				return err
			}

			month, err := strconv.ParseInt(c.Param("month"), 10, 0)
			if err != nil {
				return httperr.InvalidParameter("month")
			}

			day, err := strconv.ParseInt(c.Param("day"), 10, 0)
			if err != nil {
				return httperr.InvalidParameter("day")
			}

			d, err := time.Parse("2006-01-02", fmt.Sprintf("%04d-%02d-%02d", year, month, day))
			if err != nil {
				return httperr.BadRequest(err, "invalid date")
			}

			q := new(calllogdb.SearchQuery).
				AtDate(d)

			logs, err := app.CallLogs.Search(ctx, q)
			if err != nil {
				return err
			}

			// make sure we reply with an empty array instead of "null"
			if logs == nil {
				logs = make([]v1alpha.CallLog, 0)
			}

			c.JSON(http.StatusOK, logs)
			return nil
		},
	)
}
