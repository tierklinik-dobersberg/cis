package doorapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// CurrentStateEndpoint returns the current state of the door
// and when the next state change is expected.
func CurrentStateEndpoint(grp *app.Router) {
	grp.GET(
		"v1/state",
		permission.OneOf{
			GetStateAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			currentState, until, resetInProgress := app.Door.Current(ctx)

			return c.JSON(http.StatusOK, gin.H{
				"state":           currentState,
				"until":           until.Format(time.RFC3339),
				"resetInProgress": resetInProgress,
			})
		},
	)
}
