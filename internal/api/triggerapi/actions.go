package triggerapi

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

const externalTriggerID = "__external"

var (
	ReadTriggerAction = permission.MustDefineAction(
		"trigger:read",
		"Permission to read exposed triggers",
		nil,
	)

	ExecuteTriggerAction = permission.MustDefineAction(
		"trigger:execute",
		"Permission to execute a trigger",
		func(c *gin.Context) (string, error) {
			name := c.Param("trigger")
			if name == "" {
				return "", fmt.Errorf("permssion not applicable")
			}
			return name, nil
		},
	)
)
