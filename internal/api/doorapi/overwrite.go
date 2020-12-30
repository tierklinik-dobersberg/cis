package doorapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/service/server"
)

// OverwriteEndpoint allows to overwrite the door state
// for a specified amount of time.
func OverwriteEndpoint(grp gin.IRouter) {
	grp.POST("v1/overwrite", func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		// parse the request body
		var body struct {
			State    string `json:"state"`
			Duration string `json:"duration"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		// convert the command to the expected door state.
		switch body.State {
		case "lock":
			body.State = "locked"
		case "unlock":
			body.State = "unlocked"
		default:
			server.AbortRequest(c, http.StatusBadRequest, fmt.Errorf("invalid door state %q", body.State))
			return
		}

		// ensure it contains a valid duration
		d, err := time.ParseDuration(body.Duration)
		if err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}
		if d < 0 {
			server.AbortRequest(c, http.StatusBadRequest, errors.New("invalid duration"))
			return
		}

		// overwrite the current state
		until := time.Now().Add(d)
		err = app.Door.Overwrite(c.Request.Context(), openinghours.DoorState(body.State), until)
		if err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		current, next := app.Door.Current(c.Request.Context())
		c.JSON(http.StatusOK, gin.H{
			"state": current,
			"until": next,
		})
	})
}
