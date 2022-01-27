package doorapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("doorapi")

// Setup registers all routes for the door controller.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/door/v1/test/:year/:month/:day/:hour/:minute
	TestStateEndpoint(router)

	// GET /api/door/v1/state
	CurrentStateEndpoint(router)

	// POST /api/door/v1/reset
	ResetDoorEndpoint(router)

	// POST /api/door/v1/overwrite
	OverwriteEndpoint(router)
}
