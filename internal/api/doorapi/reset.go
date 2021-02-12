package doorapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// ResetDoorEndpoint resets the door controller and the door itself
// and re-applies the current expected state.
func ResetDoorEndpoint(grp *app.Router) {
	grp.POST(
		"v1/reset",
		permission.OneOf{
			SetStateAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			err := app.Door.Reset(ctx)
			if err != nil {
				return err
			}

			current, until, resetInProgress := app.Door.Current(ctx)
			c.JSON(http.StatusOK, gin.H{
				"state":           current,
				"until":           until,
				"resetInProgress": resetInProgress,
			})
			return nil
		},
	)
}
