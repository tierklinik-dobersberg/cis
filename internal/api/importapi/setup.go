package importapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	ImportNeumayrContactsEndpoint(router)
}
