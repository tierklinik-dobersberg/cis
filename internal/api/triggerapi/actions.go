package triggerapi

import (
	"fmt"

	"github.com/labstack/echo/v4"
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
		func(c echo.Context) (string, error) {
			name := c.Param("trigger")
			if name == "" {
				return "", fmt.Errorf("permission not applicable")
			}
			return name, nil
		},
	)
)
