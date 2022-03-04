package triggerapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

type MatchSpecResponse struct {
	Spec []conf.OptionSpec `json:"spec"`
}

func GetMatchSpecEndpoint(router *app.Router) {
	router.GET(
		"v1/match-spec",
		permission.OneOf{
			ManageTriggerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			return c.JSON(http.StatusOK, MatchSpecResponse{
				Spec: trigger.MatchSpec.All(),
			})
		},
	)
}
