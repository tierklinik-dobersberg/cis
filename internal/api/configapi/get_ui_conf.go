package configapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// GetUIConfigEndpoint provides access to the UI configuration.
func GetUIConfigEndpoint(grp gin.IRouter) {
	grp.GET("v1/ui", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		c.JSON(http.StatusOK, app.Config.UI)
	})
}
