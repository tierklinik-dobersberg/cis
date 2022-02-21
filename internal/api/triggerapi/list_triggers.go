package triggerapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

type TriggerInstance struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Pending     bool     `json:"pending"`
	Groups      []string `json:"groups"`
}

type TriggerListResponse struct {
	Instances []TriggerInstance `json:"instances"`
}

func ListTriggerEndpoint(router *app.Router) {
	router.GET(
		"v1",
		permission.OneOf{
			ReadTriggerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			sess := session.Get(c)

			// collect all instances the user has access to.
			var instances []TriggerInstance
			for _, instance := range trigger.DefaultRegistry.Instances() {
				req := &permission.Request{
					User:     sess.User.Name,
					Resource: instance.Name(),
					Action:   ReadTriggerAction.Name,
				}
				permitted, err := app.Matcher.Decide(ctx, req, sess.ExtraRoles())
				if err != nil {
					return httperr.InternalError().SetInternal(err)
				}
				if permitted {
					instances = append(instances, TriggerInstance{
						Name:        instance.Name(),
						Description: instance.Description(),
						Pending:     instance.Pending(),
						Groups:      instance.Groups(),
					})
				}
			}

			return c.JSON(http.StatusOK, TriggerListResponse{
				Instances: instances,
			})
		},
	)
}
