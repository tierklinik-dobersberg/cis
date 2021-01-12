package holidayapi

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
)

// GetForMonthEndpoint returns all holidays in the
// given month.
func GetForMonthEndpoint(grp gin.IRouter) {
	grp.GET("v1/:year/:month", func(c *gin.Context) {
		app := app.From(c)
		if app != nil {
			return
		}

		year, err := strconv.ParseInt(c.Param("year"), 10, 64)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		month, err := strconv.ParseInt(c.Param("month"), 10, 64)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		holidays, err := app.Holidays.Get(c.Request.Context(), app.Config.Country, int(year))
		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		prefix := fmt.Sprintf("%d-%02d-", year, month)
		result := make([]openinghours.PublicHoliday, 0, len(holidays))
		for _, day := range holidays {
			logger.From(c.Request.Context()).Infof("checking %s against %s", day.Date, prefix)
			if strings.HasPrefix(day.Date, prefix) {
				result = append(result, day)
			}
		}

		c.JSON(http.StatusOK, result)
	})
}
