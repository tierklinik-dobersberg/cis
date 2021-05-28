package triggerapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

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
			return name, nil
		},
	)
)
