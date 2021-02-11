package calllogapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
)

// ForDateEndpoint allows retrieving all calllogs for a given
// date.
func ForDateEndpoint(grp *app.Router) {
	grp.GET(
		"v1/date/:year/:month/:day",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			year, err := strconv.ParseInt(c.Param("year"), 10, 0)
			if err != nil {
				return err
			}

			month, err := strconv.ParseInt(c.Param("month"), 10, 0)
			if err != nil {
				return httperr.BadRequest(err, "invalid month")
			}

			day, err := strconv.ParseInt(c.Param("day"), 10, 0)
			if err != nil {
				return httperr.BadRequest(err, "invalid day")
			}

			d, err := time.Parse("2006-01-02", fmt.Sprintf("%04d-%02d-%02d", year, month, day))
			if err != nil {
				return httperr.BadRequest(err, "invalid date")
			}

			logs, err := app.CallLogs.ForDate(ctx, d)
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
