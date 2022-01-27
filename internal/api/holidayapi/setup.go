package holidayapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("holidayapi")

// Setup configures the holidayapi endpoints.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/holidays/v1/:year
	GetForYearEndpoint(router)

	// GET /api/holidays/v1/:year/:month
	GetForMonthEndpoint(router)
}
