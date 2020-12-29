package doorapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/service/server"
)

// ResetDoorEndpoint resets the door controller and the door itself
// and re-applies the current expected state.
func ResetDoorEndpoint(grp gin.IRouter) {
	grp.POST("v1/reset", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		err := app.Door.Reset(c.Request.Context())
		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		current, until := app.Door.Current(c.Request.Context())
		c.JSON(http.StatusOK, gin.H{
			"state": current,
			"until": until,
		})
	})
}
