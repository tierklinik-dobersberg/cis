package rosterapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func GetDayEndpoint(grp *app.Router) {
	grp.GET(
		"v1/roster/:year/:month/:day",
		permission.OneOf{
			ReadRosterAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			month, year, err := getYearAndMonth(c)
			if err != nil {
				return err
			}

			day, err := strconv.ParseInt(c.Param("day"), 10, 0)
			if err != nil {
				return httperr.InvalidParameter("day", err.Error())
			}

			roster, err := app.DutyRosters.ForMonth(ctx, month, year)
			if err != nil {
				return err
			}

			d, ok := roster.Days[int(day)]
			if !ok {
				return httperr.NotFound("roster-day", fmt.Sprintf("%d-%d-%d", year, month, day), nil)
			}

			c.JSON(http.StatusOK, d)
			return nil
		},
	)
}
