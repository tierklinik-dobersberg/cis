package voicemailapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)

	// GET /api/voicemail/v1/search
	SearchEndpoint(router)

	// GET /api/voicemail/v1/recording/:id
	LoadRecordingEndpoint(router)

	// GET /api/voicemail/v1/list
	ListMailboxes(router)

	// PUT /api/voicemail/v1/recording/:id/seen
	MarkAsSeenEndpoint(router)

	// DELETE /api/voicemail/v1/recording/:id/seen
	MarkAsUnseenEndpoint(router)
}
