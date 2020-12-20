package rosterapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
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
