package rosterapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/roster"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
)

// CreateOrUpdateEndpoint allows to either create a new or update
// an existing roster.
func CreateOrUpdateEndpoint(grp *app.Router) {
	grp.PUT(
		"v1/roster/:year/:month",
		permission.OneOf{
			WriteRosterAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			month, year, err := getYearAndMonth(c)
			if err != nil {
				return err
			}

			_, err = app.DutyRosters.ForMonth(ctx, month, year)
			if err != nil && !errors.Is(err, roster.ErrNotFound) {
				return err
			}

			var body v1alpha.DutyRoster
			if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
				return httperr.BadRequest(err)
			}

			if body.Month != month || body.Year != year {
				return httperr.BadRequest(fmt.Sprintf(
					"body specifies a different year/month. body.year = %d, param.year=%d body.month = %d, param.month = %d",
					body.Year, year, body.Month, month,
				))
			}

			if err := validateRoster(ctx, app, &body); err != nil {
				return httperr.BadRequest(err)
			}

			if errors.Is(err, roster.ErrNotFound) {
				err = app.DutyRosters.Create(ctx, body.Month, body.Year, body.Days)
			} else {
				err = app.DutyRosters.Update(ctx, &body)
			}

			if err != nil {
				return err
			}

			c.NoContent(http.StatusNoContent)
			return nil
		},
	)
}

func validateRoster(ctx context.Context, app *app.App, roster *v1alpha.DutyRoster) error {
	// Come one, I guess 2100 is enough ...
	if roster.Year < 2019 || roster.Year > 2100 {
		return fmt.Errorf("invalid year")
	}

	if roster.Month < time.January || roster.Month > time.December {
		return fmt.Errorf("invalid month")
	}

	allUsers, err := app.Identities.ListAllUsers(ctx)
	if err != nil {
		return err
	}
	lm := make(map[string]cfgspec.User, len(allUsers))
	for _, user := range allUsers {
		lm[strings.ToLower(user.Name)] = user
	}

	midnight := daytime.Midnight(time.Now())
	for date, day := range roster.Days {
		// we allow disabled users only for days that are already in the past.
		// this is a simple work-around to allow users to edit the currently active
		// roster even if it referes to a now disabled user on days already in the past.
		allowDisabled := time.Date(roster.Year, roster.Month, date, 0, 0, 0, 0, app.Location()).Before(midnight)

		if err := validateUsers(day.Forenoon, lm, allowDisabled); err != nil {
			return fmt.Errorf("forenoon: %w", err)
		}
		if err := validateUsers(day.Afternoon, lm, allowDisabled); err != nil {
			return fmt.Errorf("afternoon: %w", err)
		}
		// TODO(ppacher): let the user configure if on-call shifts
		// should be required!
		if err := validateUsers(day.OnCall.Day, lm, allowDisabled); err != nil {
			return fmt.Errorf("onCal.day: %w", err)
		}
		if err := validateUsers(day.OnCall.Night, lm, allowDisabled); err != nil {
			return fmt.Errorf("oncall.Night: %w", err)
		}
	}

	return nil
}

func validateUsers(users []string, lm map[string]cfgspec.User, allowDisabled bool) error {
	for _, u := range users {
		user, ok := lm[strings.ToLower(u)]
		if !ok {
			return fmt.Errorf("unknown user %s", u)
		}
		if !allowDisabled && user.Disabled {
			return fmt.Errorf("user %s is disabled", u)
		}
	}
	return nil
}
