package triggerapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/logger"
)

func ExecuteTriggerEndpoint(router *app.Router) {
	router.POST(
		"v1/instance/:id",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			triggerName := c.Param("id")

			instance := findInstance(triggerName, app.Trigger.Instances())
			if instance == nil {
				return httperr.NotFound("trigger ", triggerName)
			}
			// TODO(ppacher): we may add support for custom event IDs instead
			// of the hard-coded __external.
			if instance.Wants(externalTriggerID) {
				err := instance.Handle(ctx, &event.Event{
					ID:      externalTriggerID,
					Created: time.Now(),
				})
				if err != nil {
					logger.From(ctx).Errorf("failed to handle external trigger %s: %s", instance.ID(), err)
				}
			} else {
				return httperr.PreconditionFailed("trigger does not support being triggered via API")
			}

			return c.NoContent(http.StatusAccepted)
		},
	)
}

func findInstance(name string, instances []*trigger.Instance) *trigger.Instance {
	for _, i := range instances {
		if i.ID() == name {
			return i
		}
	}

	return nil
}
