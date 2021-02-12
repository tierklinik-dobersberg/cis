package holidayapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// GetForYearEndpoint returns all holidays in the
// given year.
func GetForYearEndpoint(grp *app.Router) {
	grp.GET(
		"v1/:year",
		permission.Anyone, // public domain
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			year, err := strconv.ParseInt(c.Param("year"), 10, 64)
			if err != nil {
				return httperr.BadRequest(err, "invalid year")
			}

			holidays, err := app.Holidays.Get(ctx, app.Config.Country, int(year))
			if err != nil {
				return err
			}

			if holidays == nil {
				// make sure we send an empty array.
				holidays = make([]openinghours.PublicHoliday, 0)
			}

			c.JSON(http.StatusOK, holidays)
			return nil
		},
	)
}
