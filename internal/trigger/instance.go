package trigger

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/event"
)

// Instances wraps a trigger type handler and adds
// additional methods like buffering and debouncing
// of events.
type Instance struct {
	handler Handler
}

// NewInstance creates a new trigger instance for handler.
func NewInstance(handler Handler) *Instance {
	return &Instance{
		handler: handler,
	}
}

func (inst *Instance) Handle(ctx context.Context, evt *event.Event) {
	// Direct passthrough to the handler if neither BufferUntil= or
	// DebounceUntil= is set.
	inst.handler.HandleEvents(ctx, evt)
}
