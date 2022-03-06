package triggerapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

func WaitForEventEndpoint(router *app.Router) {
	router.GET(
		"v1/wait",
		// FIXME(ppacher): proper permission to get event body?
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			eventNames := c.QueryParams()["event"]
			clientID := fmt.Sprintf("%s-event-sub-%s", session.UserFromCtx(ctx), uuid.New().String())

			ctx, cancel := context.WithCancel(ctx)
			defer cancel()

			if timeoutStr := c.QueryParam("timeout"); timeoutStr != "" {
				timeout, err := time.ParseDuration(timeoutStr)
				if err != nil {
					return httperr.InvalidParameter("timeout", err.Error())
				}

				ctx, cancel = context.WithTimeout(ctx, timeout)
				defer cancel()
			}

			result := make(chan *event.Event, 1)

			for _, eventName := range eventNames {
				go func(eventName string) {
					defer app.Trigger.EventRegistry().Unsubscribe(clientID, eventName)

					ch := app.Trigger.EventRegistry().Subscribe(clientID, eventName)

					var value *event.Event
					select {
					case value = <-ch:
					case <-ctx.Done():
						return
					}

					select {
					case result <- value:
					default:
					}
				}(eventName)
			}

			// wait for the first event
			select {
			case evt := <-result:
				return c.JSON(http.StatusOK, evt)

			case <-ctx.Done():
				if errors.Is(ctx.Err(), context.DeadlineExceeded) {
					return c.NoContent(http.StatusRequestTimeout)
				}

				return ctx.Err()
			}
		},
	)
}
