package triggerapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	GetMatchSpecEndpoint(router)
	ListActionTypesEndpoint(router)
	ListTriggerEndpoint(router)
	ExecuteTriggerEndpoint(router)
	ExecuteTriggerGroupEndpoint(router)
	CreateUpdateDeleteTriggerEndpoints(router)
	ListEventTypesEndpoint(router)
}
