package rosterapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// GetForMonthEndpoint supports getting the duty roster for
// a given month.
func GetForMonthEndpoint(grp *app.Router) {
	grp.GET(
		"v1/roster/:year/:month",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			month, year, err := getYearAndMonth(c)
			if err != nil {
				return err
			}

			roster, err := app.DutyRosters.ForMonth(ctx, month, year)
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, roster)
			return nil
		},
	)
}
