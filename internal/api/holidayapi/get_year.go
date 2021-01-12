package holidayapi

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/service/server"
)

// GetForYearEndpoint returns all holidays in the
// given year.
func GetForYearEndpoint(grp gin.IRouter) {
	grp.GET("v1/:year", func(c *gin.Context) {
		app := app.From(c)
		if app != nil {
			return
		}

		year, err := strconv.ParseInt(c.Param("year"), 10, 64)
		if err != nil {
			server.AbortRequest(c, 0, err)
			return
		}

		holidays, err := app.Holidays.Get(app.Config.Country, int(year))
		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.JSON(http.StatusOK, holidays)
	})
}
