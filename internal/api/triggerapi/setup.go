package triggerapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

func Setup(grp gin.IRouter, triggers *[]*trigger.Instance) {
	router := app.NewRouter(grp)

	ListTriggerEndpoint(router, triggers)
	ExecuteTriggerEndpoint(router, triggers)
	ExecuteTriggerGroupEndpoint(router, triggers)
}
