package calendarapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calendar/v1alpha"
)

func CreateEventEndpoint(router *app.Router) {
	router.POST(
		"v1/events",
		permission.OneOf{
			WriteEventsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			var event v1alpha.CreateEventCall

			if err := json.NewDecoder(c.Request.Body).Decode(&event); err != nil {
				return httperr.BadRequest(err)
			}

			if err := validateEventModel(ctx, app, &event); err != nil {
				return err
			}

			duration := event.EndTime.Sub(event.StartTime)
			if err := app.Calendar.CreateEvent(
				ctx,
				event.CalendarID,
				event.Summary,
				event.Description,
				event.StartTime,
				duration,
				event.Data,
			); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)

			return nil
		},
	)
}

func validateEventModel(ctx context.Context, app *app.App, event *v1alpha.CreateEventCall) error {
	var duration time.Duration
	if event.Duration != "" {
		var err error
		duration, err = time.ParseDuration(event.Duration)
		if err != nil {
			return httperr.InvalidField("duration")
		}
	} else if event.EndTime != nil {
		duration = event.EndTime.Sub(event.StartTime)
		if duration < 0 {
			return httperr.InvalidField("endTime")
		}
	}
	if duration == 0 {
		return httperr.MissingField("duration or endTime")
	}
	if event.FullDayEvent {
		return httperr.BadRequest(nil, "full day events are not yet supported")
	}

	end := event.StartTime.Add(duration)
	event.EndTime = &end

	if event.Data != nil {
		if event.Data.CreatedBy != "" {
			_, err := app.Identities.GetUser(ctx, event.Data.CreatedBy)
			if err != nil {
				return err
			}
		}
		if event.Data.CustomerSource != "" {
			// FIXME(ppacher): we should allow values for unknown customers too.
			// But we might need a different [CIS] stanzs for the event description.
			_, err := app.Customers.CustomerByCID(ctx, event.Data.CustomerSource, event.Data.CustomerID)
			if err != nil {
				return err
			}
			for _, animal := range event.Data.AnimalID {
				// FIXME(ppacher): we should allow values for unknown animals too.
				// See FIXME above.
				if _, err := app.Patients.ByCustomerAndAnimalID(
					ctx,
					event.Data.CustomerSource,
					event.Data.CustomerID,
					animal,
				); err != nil {
					return err
				}
			}
		} else if len(event.Data.AnimalID) > 0 {
			return httperr.MissingField("customerSource and customerID")
		}

		for _, requiredResource := range event.Data.RequiredResources {
			if _, err := app.Resources.Get(requiredResource); err != nil {
				return err
			}
		}
	}

	return nil
}
