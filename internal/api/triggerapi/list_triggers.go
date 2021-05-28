package triggerapi

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func ListTriggerEndpoint(router *app.Router) {
	router.GET(
		"v1/triggers",
		ReadTriggerAction,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			return nil
		},
	)
}
