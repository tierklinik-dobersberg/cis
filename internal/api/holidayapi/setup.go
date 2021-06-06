package holidayapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("holidayapi")

// Setup configures the holidayapi endpoints.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/holidays/v1/:year
	GetForYearEndpoint(router)

	// GET /api/holidays/v1/:year/:month
	GetForMonthEndpoint(router)
}
