package triggerapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/session"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

type TriggerInstance struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Pending     bool   `json:"pending"`
}

type TriggerListResponse struct {
	Instances []TriggerInstance `json:"instances"`
}

func ListTriggerEndpoint(router *app.Router, triggers *[]*trigger.Instance) {
	router.GET(
		"v1",
		permission.OneOf{
			ReadTriggerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			sess := session.Get(c)

			// collect all instances the user has access to.
			var instances []TriggerInstance
			for _, i := range *triggers {
				req := &permission.Request{
					User:     sess.User.Name,
					Resource: i.Name(),
					Action:   ReadTriggerAction.Name,
				}
				permitted, err := app.Matcher.Decide(ctx, req)
				if err != nil {
					return httperr.InternalError(err)
				}
				if permitted {
					instances = append(instances, TriggerInstance{
						Name:        i.Name(),
						Description: i.Description(),
						Pending:     i.Pending(),
					})
				}
			}
			c.JSON(http.StatusOK, TriggerListResponse{
				Instances: instances,
			})
			return nil
		},
	)
}
