package voicemailapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

var (
	// ReadVoicemailsAction is the action that must be permitted to search
	// for voicemails.
	ReadVoicemailsAction = permission.MustDefineAction(
		"voicemail:read",
		"Permission required to read a certain voicemail",
		func(c *gin.Context) (string, error) {
			// name= parameter might be empty in which case all
			// voicemails are searched for.
			voiceMail := c.Query("name")
			return voiceMail, nil
		},
	)
)
