package google

import "github.com/tierklinik-dobersberg/cis/runtime/event"

var (
	eventCreated = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/calendar/google/event/created",
	})
	eventUpdated = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/calendar/google/event/updated",
	})
	eventDeleted = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/calendar/google/event/deleted",
	})
)
