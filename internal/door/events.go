package door

import "github.com/tierklinik-dobersberg/cis/runtime/event"

var (
	eventDoorOpen = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/door/open",
	})
	eventDoorLock = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/door/lock",
	})
	eventDoorUnlock = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/door/unlock",
	})
)
