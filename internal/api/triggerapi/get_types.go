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

type ActionType struct {
	trigger.ActionType

	Spec []conf.OptionSpec `json:"spec"`
}

type ListActionTypeResponse struct {
	Actions []ActionType `json:"actions"`
}

func ListActionTypesEndpoint(r *app.Router) {
	r.GET(
		"v1/action-type",
		permission.OneOf{
			ManageTriggerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			actions := app.Trigger.ActionTypes()

			res := ListActionTypeResponse{
				Actions: make([]ActionType, len(actions)),
			}

			for idx, a := range actions {
				res.Actions[idx] = ActionType{
					ActionType: a,
					Spec:       a.Spec.All(),
				}
			}

			return c.JSON(http.StatusOK, res)
		},
	)
}
