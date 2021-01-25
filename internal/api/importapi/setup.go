package importapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	ImportNeumayrContactsEndpoint(router)
}
