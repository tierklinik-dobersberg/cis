package voicemailapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

// Setup registers all available VoiceMail related
// HTTP routes on grp.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// GET /api/voicemail/v1/search
	SearchEndpoint(router)

	// GET /api/voicemail/v1/recording/:id
	LoadRecordingEndpoint(router)

	// GET /api/voicemail/v1/list
	ListMailboxesEndpoint(router)

	// PUT /api/voicemail/v1/recording/:id/seen
	MarkAsSeenEndpoint(router)

	// DELETE /api/voicemail/v1/recording/:id/seen
	MarkAsUnseenEndpoint(router)
}
