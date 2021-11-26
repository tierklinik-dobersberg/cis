package rosterapi

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetForMonthEndpoint supports getting the duty roster for
// a given month.
func GetForMonthEndpoint(grp *app.Router) {
	grp.GET(
		"v1/roster/:year/:month",
		permission.OneOf{
			ReadRosterAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			withShiftStartTimes := true
			if val := c.Query("with-shift-start"); val != "" {
				v, err := strconv.ParseBool(val)
				if err != nil {
					return httperr.InvalidParameter("with-shift-start", err.Error())
				}
				withShiftStartTimes = v
			}

			month, year, err := getYearAndMonth(c)
			if err != nil {
				return err
			}

			roster, err := app.DutyRosters.ForMonth(ctx, month, year)
			if err != nil {
				return err
			}

			if withShiftStartTimes {
				numberOfDays := time.Date(year, month+1, 0, 0, 0, 0, 0, app.Location()).Day()
				for i := 1; i <= numberOfDays; i++ {
					date := time.Date(year, month, i, 0, 0, 0, 0, app.Location())
					d := roster.Days[i]
					addStartTimes(ctx, app, date, &d)
					roster.Days[i] = d
				}
			}

			c.JSON(http.StatusOK, roster)
			return nil
		},
	)
}
