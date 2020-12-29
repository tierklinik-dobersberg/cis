package doorapi

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func CurrentStateEndpoint(grp gin.IRouter) {
	grp.GET("v1/state", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		currentState, until := app.Door.Current(c.Request.Context())
		c.JSON(http.StatusOK, gin.H{
			"state": currentState,
			"until": until.Format(time.RFC3339),
		})
	})
}
