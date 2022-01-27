package infoscreenapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup defines all routes for the infoscreen API.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	EnabledEndpoint(router)

	// Layout API
	RenderLayoutPreviewEndpoint(router)
	ListLayoutNamesEndpoint(router)
	GetLayoutEndpoint(router)

	// Shows API
	ListShowsEndpoint(router)
	GetShowEndpoint(router)
	CreateShowEndpoint(router)
	DeleteShowEndpoint(router)
	UploadFileEndpoint(router)
}

func SetupPlayer(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	PlayShowEndpoint(router)
}
