package infoscreenapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup defines all routes for the infoscreen API.
func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

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

func SetupPlayer(grp gin.IRouter) {
	router := app.NewRouter(grp)

	PlayShowEndpoint(router)
}
