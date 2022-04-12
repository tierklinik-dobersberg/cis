package app

import "github.com/tierklinik-dobersberg/cis/runtime/event"

var (
	appStartedEvent = event.MustRegisterType(event.Type{
		ID:          "sys/cis/started",
		Description: "Fired when CIS is started",
	})
)
