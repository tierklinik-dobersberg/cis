package holidayapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// GetForMonthEndpoint returns all holidays in the
// given month.
func GetForMonthEndpoint(grp *app.Router) {
	grp.GET(
		"v1/:year/:month",
		permission.Anyone, // public domain
		func(ctx context.Context, app *app.App, c echo.Context) error {
			log := log.From(ctx)

			year, err := strconv.ParseInt(c.Param("year"), 10, 0)
			if err != nil {
				return httperr.InvalidParameter("year", err.Error())
			}

			month, err := strconv.ParseInt(c.Param("month"), 10, 0)
			if err != nil {
				return httperr.InvalidParameter("month", err.Error())
			}

			holidays, err := app.Holidays.Get(ctx, app.Config.Country, int(year))
			if err != nil {
				return err
			}

			log.Infof("loading holidays for %d/%d: %+v", year, month, holidays)

			prefix := fmt.Sprintf("%d-%02d-", year, month)
			result := make([]openinghours.PublicHoliday, 0, len(holidays))
			for _, day := range holidays {
				log.Infof("checking %s against %s", day.Date, prefix)
				if strings.HasPrefix(day.Date, prefix) {
					result = append(result, day)
				}
			}

			c.JSON(http.StatusOK, result)
			return nil
		},
	)
}
