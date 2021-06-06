package event

import "time"

// EventData is an opaque type for data attached to events
// fired by the event registry. The event data is not inspected
// by the registry but is likely used by any event subscribers.
// It's recommended that users make sure that the data attached
// to events is JSON serializable in case it's transmitted over
// network or file.
type EventData interface{}

// Event is an event emitted by a event registry and published
// to any subscriber.
type Event struct {
	// ID is the ID (or topic) of the event. The ID is used by
	// the registry to notify subscriptions that have a matching
	// topic filter.
	ID string `json:"id"`
	// Data is an opaque interface that is set to any
	// event data. Note that Data must not be modified after
	// the event has been fired or received on a subscription
	// channel. Callers of Fire() should make sure to send a
	// copy of their data if further manipulation is planned.
	// Subscribers many only perform read access as no synchronization
	// is in place.
	Data EventData `json:"data"`
	// Created is set to the current time when calling Fire().
	Created time.Time `json:"createdAt"`
}
