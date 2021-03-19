package event

import (
	"context"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

type Registry struct {
	l           sync.RWMutex
	subscribers map[string]map[string]chan<- *Event
}

// Fire fires a new event of the given ID to all subscribers.
func (reg *Registry) Fire(ctx context.Context, id string, payload EventData) {
	reg.l.RLock()
	defer reg.l.RUnlock()

	log := logger.From(ctx).WithFields(logger.Fields{
		"eventID": id,
	})

	evt := &Event{
		ID:      id,
		Data:    payload,
		Created: time.Now(),
	}

	for key := range reg.subscribers[id] {
		ch := reg.subscribers[id][key]
		go func(key string) {
			select {
			case ch <- evt:
			case <-time.After(time.Second):
				log.WithFields(logger.Fields{
					"subscriber": key,
				}).Errorf("failed to notify event subscriber")
			}
		}(key)
	}
}

// Subscribe subscribes to events of the given eventID. All events
// fired on the registry that match the subscribed ID are published
// to the returned channel. Note that the order of events is not
// guaranteed.
func (reg *Registry) Subscribe(client, eventID string) <-chan *Event {
	reg.l.Lock()
	defer reg.l.Unlock()

	if reg.subscribers == nil {
		reg.subscribers = make(map[string]map[string]chan<- *Event)
	}

	if _, ok := reg.subscribers[eventID]; !ok {
		reg.subscribers[eventID] = make(map[string]chan<- *Event)
	}

	ch := make(chan *Event)
	reg.subscribers[eventID][client] = ch

	return ch
}

// Subscribe subscribes to events on the DefaultRegistry.
func Subscribe(client, eventID string) <-chan *Event {
	return DefaultRegistry.Subscribe(client, eventID)
}

// Fire fires an event on the DefaultRegistry.
func Fire(ctx context.Context, id string, payload EventData) {
	DefaultRegistry.Fire(ctx, id, payload)
}

// DefaultRegistry is the event registry used by package level functions.
var DefaultRegistry = new(Registry)
