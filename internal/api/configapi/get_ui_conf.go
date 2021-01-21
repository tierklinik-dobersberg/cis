package configapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// GetUIConfigEndpoint provides access to the UI configuration.
func GetUIConfigEndpoint(grp *app.Router) {
	grp.GET("v1/ui", func(ctx context.Context, app *app.App, c *gin.Context) error {
		c.JSON(http.StatusOK, app.Config.UI)
		return nil
	})
}
