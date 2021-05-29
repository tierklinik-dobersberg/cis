package triggerapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

func ExecuteTriggerEndpoint(router *app.Router, instances *[]*trigger.Instance) {
	router.POST(
		"v1/:trigger",
		permission.OneOf{
			ExecuteTriggerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			trigger := c.Param("trigger")

			instance := findInstance(trigger, *instances)
			if instance == nil {
				return httperr.BadRequest(nil, "trigger "+trigger)
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
			c.Status(http.StatusAccepted)

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
