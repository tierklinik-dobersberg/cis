package doorapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/door"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

// OverwriteEndpoint allows to overwrite the door state
// for a specified amount of time.
func OverwriteEndpoint(grp *app.Router) {
	grp.POST(
		"v1/overwrite",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			// parse the request body
			var body struct {
				State    string `json:"state"`
				Duration string `json:"duration"`
			}
			if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
				return httperr.BadRequest("invalid body").SetInternal(err)
			}

			// convert the command to the expected door state.
			switch body.State {
			case "lock":
				body.State = "locked"
			case "unlock":
				body.State = "unlocked"
			case "open":
				// open is not actually a overwrite but rather
				// a short term action
				ctx, cancel := context.WithTimeout(ctx, time.Second*2)
				defer cancel()

				if err := app.Door.Open(ctx); err != nil {
					return httperr.InternalError(err.Error()).SetInternal(err)
				}

				return c.NoContent(http.StatusOK)

			default:
				return httperr.InvalidField("state")
			}

			// ensure it contains a valid duration
			setDuration, err := time.ParseDuration(body.Duration)
			if err != nil {
				return httperr.InvalidField("duration")
			}
			if setDuration < 0 {
				return httperr.InvalidField("duration")
			}

			until := time.Now().Add(setDuration)

			log.From(ctx).WithFields(logger.Fields{
				"duration": setDuration.String(),
				"state":    body.State,
				"until":    until.String(),
			}).V(6).Logf("received manual door overwrite request")

			// overwrite the current state
			err = app.Door.Overwrite(ctx, door.State(body.State), until)
			if err != nil {
				return err
			}

			current, next, resetInProgress := app.Door.Current(ctx)

			return c.JSON(http.StatusOK, gin.H{
				"state":           current,
				"until":           next,
				"resetInProgress": resetInProgress,
			})
		},
	)
}
