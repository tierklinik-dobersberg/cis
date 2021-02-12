package holidayapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/logger"
)

// GetForMonthEndpoint returns all holidays in the
// given month.
func GetForMonthEndpoint(grp *app.Router) {
	grp.GET(
		"v1/:year/:month",
		permission.Anyone, // public domain
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			log := logger.From(ctx)

			year, err := strconv.ParseInt(c.Param("year"), 10, 64)
			if err != nil {
				return httperr.BadRequest(err, "invalid year")
			}

			month, err := strconv.ParseInt(c.Param("month"), 10, 64)
			if err != nil {
				return httperr.BadRequest(err, "invalid month")
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
