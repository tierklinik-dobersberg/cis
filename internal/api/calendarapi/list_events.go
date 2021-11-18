package calendarapi

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/calendar"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calendar/v1alpha"
	"golang.org/x/sync/errgroup"
)

// ListEventsEndpoint returns all calendar events that match the
// provided query.
func ListEventsEndpoint(router *app.Router) {
	router.GET(
		"v1/events",
		permission.OneOf{
			ReadEventsAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			day, err := getForDayQueryParam(c, app)
			if err != nil {
				return err
			}

			filter := new(calendar.EventSearchOptions).ForDay(day)

			calendars, calIDtoCal, err := getCalendars(ctx, app)
			if err != nil {
				return err
			}

			// get all users and build a lookup map
			users, err := app.Identities.ListAllUsers(ctx)
			if err != nil {
				return err
			}
			userNameToUser := make(map[string]cfgspec.User)
			calIDtoUser := make(map[string]cfgspec.User)
			for _, user := range users {
				userNameToUser[user.Name] = user
				if user.CalendarID != "" {
					calIDtoUser[user.CalendarID] = user
				}
			}

			var requestedCalendarIDs []string
			if forUser := c.QueryArray("for-user"); len(forUser) > 0 {
				for _, username := range forUser {
					user, ok := userNameToUser[username]
					if !ok {
						return httperr.NotFound("user", username, nil)
					}
					if user.CalendarID == "" {
						return httperr.WithCode(
							http.StatusExpectationFailed,
							fmt.Errorf("user %s does not have a calendar", user.Name),
						)
					}
					requestedCalendarIDs = append(requestedCalendarIDs, user.CalendarID)
				}
			}

			// if no calendar IDs are requested we'll provide all of them.
			if len(requestedCalendarIDs) == 0 {
				for _, cal := range calendars {
					requestedCalendarIDs = append(requestedCalendarIDs, cal.ID)
				}
			}

			var (
				events []calendar.Event
				l      sync.Mutex
			)
			grp, ctx := errgroup.WithContext(ctx)
			for idx := range requestedCalendarIDs {
				requestedID := requestedCalendarIDs[idx]
				grp.Go(func() error {
					calEvents, err := app.Calendar.ListEvents(ctx, requestedID, filter)
					if err != nil {
						return err
					}

					l.Lock()
					defer l.Unlock()
					events = append(events, calEvents...)

					return nil
				})
			}

			if err := grp.Wait(); err != nil {
				return err
			}

			sort.Sort(calendar.ByStartTime(events))

			// convert all events to their API model by enriching them
			// with the username where known.
			modelEvents := make([]v1alpha.Event, len(events))
			for idx, evt := range events {
				u := calIDtoUser[evt.CalendarID]
				modelEvents[idx] = v1alpha.Event{
					Event:        evt,
					Username:     u.Name,
					CalendarName: calIDtoCal[evt.CalendarID].Name,
				}
			}

			c.JSON(http.StatusOK, modelEvents)

			return nil
		},
	)
}

func getForDayQueryParam(c *gin.Context, app *app.App) (time.Time, error) {
	day := time.Now()
	if forDay := c.Query("for-day"); forDay != "" {
		var err error
		day, err = app.ParseTime("2006-1-2", forDay)
		if err != nil {
			return time.Time{}, httperr.InvalidParameter("for-day")
		}
	}
	return day, nil
}

func getCalendars(ctx context.Context, app *app.App) ([]calendar.Calendar, map[string]calendar.Calendar, error) {
	// get all calendars and build a lookup map
	calendars, err := app.Calendar.ListCalendars(ctx)
	if err != nil {
		return nil, nil, err
	}
	idToCal := make(map[string]calendar.Calendar)
	for _, cal := range calendars {
		idToCal[cal.ID] = cal
	}
	return calendars, idToCal, nil
}
