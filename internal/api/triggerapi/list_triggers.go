package triggerapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/logger"
)

type TriggerInstance struct {
	TriggerDefinition
	Pending bool `json:"pending"`
}

type TriggerListResponse struct {
	Instances []TriggerInstance `json:"instances"`
}

func ListTriggerEndpoint(router *app.Router) {
	router.GET(
		"v1/instance",
		permission.OneOf{
			ReadTriggerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			triggers, err := app.Trigger.ListTriggers(ctx)
			if err != nil {
				return err
			}

			var response TriggerListResponse

			for _, cfg := range triggers {
				response.Instances = append(response.Instances, toTriggerAPIModel(ctx, cfg, app))
			}

			return c.JSON(http.StatusOK, response)
		},
	)
}

func toTriggerAPIModel(ctx context.Context, cfg trigger.Definition, app *app.App) TriggerInstance {
	configMap := conf.NewSectionDecoder(trigger.MatchSpec).AsMap(conf.Section{
		Name:    "TriggerInstance",
		Options: cfg.Match,
	})

	actions := make([]ActionDef, 0, len(cfg.Actions))
	for _, sec := range cfg.Actions {
		actionType, err := app.Trigger.GetType(sec.Name)
		if err != nil {
			logger.From(ctx).Errorf("failed to get action type for action %s: %s", sec.ID, err)

			continue
		}
		actionMap := conf.NewSectionDecoder(actionType.Spec.All()).AsMap(sec.Section)

		actions = append(actions, ActionDef{
			ID:      sec.ID,
			Type:    sec.Name,
			Options: actionMap,
		})
	}

	return TriggerInstance{
		TriggerDefinition: TriggerDefinition{
			ID:      cfg.ID,
			Config:  configMap,
			Actions: actions,
		},
		Pending: false, // FIXME
	}
}
