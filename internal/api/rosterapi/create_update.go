package rosterapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
)

// CreateOrUpdateEndpoint allows to either create a new or update
// an existing roster.
func CreateOrUpdateEndpoint(grp *app.Router) {
	grp.PUT(
		"v1/roster/:year/:month",
		permission.Set{
			WriteRosterAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			month, year, err := getYearAndMonth(c)
			if err != nil {
				return err
			}

			_, err = app.DutyRosters.ForMonth(ctx, month, year)
			if err != nil && !errors.Is(err, rosterdb.ErrNotFound) {
				return err
			}

			var body v1alpha.DutyRoster
			if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
				return httperr.BadRequest(err)
			}

			if body.Month != month || body.Year != year {
				return httperr.BadRequest(nil, "body specifies a different year/month")
			}

			if err := validateRoster(ctx, app, &body); err != nil {
				return httperr.BadRequest(err)
			}

			if errors.Is(err, rosterdb.ErrNotFound) {
				err = app.DutyRosters.Create(ctx, body.Month, body.Year, body.Days)
			} else {
				err = app.DutyRosters.Update(ctx, &body)
			}

			if err != nil {
				return err
			}

			c.Status(http.StatusNoContent)
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
	lm := make(map[string]schema.User, len(allUsers))
	for _, user := range allUsers {
		lm[strings.ToLower(user.Name)] = user
	}

	for _, day := range roster.Days {
		if err := validateUsers(day.Forenoon, lm); err != nil {
			return fmt.Errorf("forenoon: %s", err)
		}
		if err := validateUsers(day.Afternoon, lm); err != nil {
			return fmt.Errorf("afternoon: %s", err)
		}
		if err := validateUsers(day.Emergency, lm); err != nil {
			return fmt.Errorf("emergency: %s", err)
		}
	}

	return nil
}

func validateUsers(users []string, lm map[string]schema.User) error {
	for _, u := range users {
		if _, ok := lm[strings.ToLower(u)]; !ok {
			return fmt.Errorf("unknown user %s", u)
		}
	}
	return nil
}
