package triggerapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
)

type ListEventTypes struct {
	EventTypes []event.Type `json:"eventTypes"`
}

func ListEventTypesEndpoint(r *app.Router) {
	r.GET(
		"v1/event-type",
		permission.OneOf{
			ManageTriggerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return c.JSON(http.StatusOK, ListEventTypes{
				EventTypes: app.Trigger.EventRegistry().ListTypes(),
			})
		},
	)
}
