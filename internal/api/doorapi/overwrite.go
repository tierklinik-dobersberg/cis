package doorapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

// OverwriteEndpoint allows to overwrite the door state
// for a specified amount of time.
func OverwriteEndpoint(grp *app.Router) {
	grp.POST(
		"v1/overwrite",
		permission.OneOf{
			SetStateAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			// parse the request body
			var body struct {
				State    string `json:"state"`
				Duration string `json:"duration"`
			}
			if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
				return httperr.BadRequest(err, "invalid body")
			}

			// convert the command to the expected door state.
			switch body.State {
			case "lock":
				body.State = "locked"
			case "unlock":
				body.State = "unlocked"
			default:
				return httperr.InvalidField("state")
			}

			// ensure it contains a valid duration
			d, err := time.ParseDuration(body.Duration)
			if err != nil {
				return httperr.InvalidField("duration")
			}
			if d < 0 {
				return httperr.InvalidField("duration")
			}

			until := time.Now().Add(d)

			log.From(c).WithFields(logger.Fields{
				"duration": d.String(),
				"state":    body.State,
				"until":    until.String(),
			}).V(6).Logf("received manual door overwrite request")

			// overwrite the current state
			err = app.Door.Overwrite(ctx, openinghours.DoorState(body.State), until)
			if err != nil {
				return err
			}

			current, next, resetInProgress := app.Door.Current(ctx)
			c.JSON(http.StatusOK, gin.H{
				"state":           current,
				"until":           next,
				"resetInProgress": resetInProgress,
			})
			return nil
		},
	)
}
