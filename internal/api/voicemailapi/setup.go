package voicemailapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	ForDateEndpoints(router)
	LoadRecordingEndpoint(router)
	ListMailboxes(router)
}
