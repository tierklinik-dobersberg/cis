package calendarapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

func DeleteEventEndpoint(router *app.Router) {
	router.DELETE(
		"v1/events/:calid/:id",
		permission.OneOf{
			DeleteEventsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			cid := c.Param("calid")
			id := c.Param("id")

			if err := app.Calendar.DeleteEvent(ctx, cid, id); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
