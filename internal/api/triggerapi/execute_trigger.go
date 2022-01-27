package triggerapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

func ExecuteTriggerEndpoint(router *app.Router) {
	router.POST(
		"v1/instance/:trigger",
		permission.OneOf{
			ExecuteTriggerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			triggerName := c.Param("trigger")

			instance := findInstance(triggerName, trigger.DefaultRegistry.Instances())
			if instance == nil {
				return httperr.BadRequest("trigger " + triggerName)
			}
			// TODO(ppacher): we may add support for custom event IDs instead
			// of the hard-coded __external.
			if instance.Wants(externalTriggerID) {
				instance.Handle(ctx, &event.Event{
					ID:      externalTriggerID,
					Created: time.Now(),
				})
			} else {
				return httperr.PreconditionFailed("trigger does not support being triggered via API")
			}
			c.NoContent(http.StatusAccepted)

			return nil
		},
	)
}

func findInstance(name string, instances []*trigger.Instance) *trigger.Instance {
	for _, i := range instances {
		if i.Name() == name {
			return i
		}
	}
	return nil
}
