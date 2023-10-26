package triggerapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

type ActionDef struct {
	ID      string                 `json:"id"`
	Type    string                 `json:"type"`
	Options map[string]interface{} `json:"options"`
}

type TriggerDefinition struct {
	ID      string                 `json:"id"`
	Config  map[string]interface{} `json:"config"`
	Actions []ActionDef            `json:"actions"`
}

func CreateUpdateDeleteTriggerEndpoints(router *app.Router) {
	handler := app.HandlerFunc(func(ctx context.Context, app *app.App, c echo.Context) error {
		triggerID := c.Param("id")

		var payload TriggerDefinition
		if err := c.Bind(&payload); err != nil {
			return err
		}

		configOptions, err := confutil.MapToOptions(payload.Config)
		if err != nil {
			return err
		}
		actionDefs := make([]runtime.Section, len(payload.Actions))
		for idx, act := range payload.Actions {
			actionOptions, err := confutil.MapToOptions(act.Options)
			if err != nil {
				return err
			}

			actionDefs[idx] = runtime.Section{
				ID: act.ID,
				Section: conf.Section{
					Name:    act.Type,
					Options: actionOptions,
				},
			}
		}
		triggerDef := trigger.Definition{
			ID:      triggerID,
			Match:   configOptions,
			Actions: actionDefs,
		}

		newID, err := app.Trigger.PutTrigger(ctx, triggerDef)
		if err != nil {
			return err
		}

		if newID == triggerID {
			return c.NoContent(http.StatusNoContent)
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"id": newID,
		})
	})

	router.POST(
		"v1/instance",
		handler,
	)
	router.PUT(
		"v1/instance/:id",
		handler,
	)
	router.GET(
		"v1/instance/:id",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			id := c.Param("id")

			trigger, err := app.Trigger.GetTrigger(ctx, id)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, toTriggerAPIModel(ctx, trigger, app))
		},
	)
	router.DELETE(
		"v1/instance/:id",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			triggerID := c.Param("id")

			if err := app.Trigger.DeleteTrigger(ctx, triggerID); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
