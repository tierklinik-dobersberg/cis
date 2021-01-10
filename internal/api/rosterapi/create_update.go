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
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/service/server"
)

// CreateOrUpdateEndpoint allows to either create a new or update
// an existing roster.
func CreateOrUpdateEndpoint(grp gin.IRouter) {
	grp.PUT("v1/:year/:month", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		month, year, ok := getYearAndMonth(c)
		if !ok {
			return
		}

		_, err := app.DutyRosters.ForMonth(c.Request.Context(), month, year)
		if err != nil && !errors.Is(err, rosterdb.ErrNotFound) {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		var body v1alpha.DutyRoster
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		if body.Month != month || body.Year != year {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "invalid year or month (url match)",
			})
			return
		}

		if err := validateRoster(c.Request.Context(), app, &body); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		if errors.Is(err, rosterdb.ErrNotFound) {
			err = app.DutyRosters.Create(c.Request.Context(), body.Month, body.Year, body.Days)
		} else {
			err = app.DutyRosters.Update(c.Request.Context(), &body)
		}

		if err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.Status(http.StatusNoContent)
	})
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
