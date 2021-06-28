package triggerapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

func ExecuteTriggerGroupEndpoint(router *app.Router, triggers *[]*trigger.Instance) {
	router.POST(
		"v1/group/:groupName",
		permission.Anyone, // we'l verify that ourself
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			sess := session.Get(c)
			groupName := c.Param(("groupName"))

			instances, err := findAllowedGroupMembers(
				ctx,
				sess.User.Name,
				app,
				*triggers,
				groupName,
			)
			if err != nil {
				return err
			}

			result := make([]TriggerInstance, 0, len(instances))
			for _, i := range instances {
				if !i.Wants(externalTriggerID) {
					continue
				}
				i.Handle(ctx, &event.Event{
					ID:      "__external",
					Created: time.Now(),
				})
				result = append(result, TriggerInstance{
					Name:        i.Name(),
					Description: i.Description(),
					Pending:     i.Pending(),
					Groups:      i.Groups(),
				})
			}
			if len(result) == 0 {
				return httperr.PreconditionFailed("no instance in this group supports being triggered via API")
			}

			c.JSON(http.StatusAccepted, TriggerListResponse{
				Instances: result,
			})
			return nil
		},
	)
}

func isInSlice(needle string, haystack []string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}

func findAllowedGroupMembers(ctx context.Context, username string, app *app.App, triggers []*trigger.Instance, groupName string) ([]*trigger.Instance, error) {
	var (
		result     []*trigger.Instance
		foundGroup bool
	)
	for _, i := range triggers {
		if !isInSlice(groupName, i.Groups()) {
			continue
		}
		foundGroup = true
		req := &permission.Request{
			User:     username,
			Action:   ExecuteTriggerAction.Name,
			Resource: i.Name(),
		}
		permitted, err := app.Matcher.Decide(ctx, req)
		if err != nil {
			return nil, err
		}
		if permitted {
			result = append(result, i)
		}
	}
	if !foundGroup {
		return nil, httperr.NotFound("trigger group", groupName, nil)
	}
	if len(result) == 0 {
		return nil, httperr.Forbidden(nil, "permission denied")
	}
	return result, nil
}
