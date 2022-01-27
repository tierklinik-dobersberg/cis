package calendarapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// DeleteEventEndpoint can be used to delete a calendar event.
func DeleteEventEndpoint(router *app.Router) {
	router.DELETE(
		"v1/events/:calid/:id",
		permission.OneOf{
			DeleteEventsAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			cid := c.Param("calid")
			id := c.Param("id")

			if err := app.Calendar.DeleteEvent(ctx, cid, id); err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)
			return nil
		},
	)
}
