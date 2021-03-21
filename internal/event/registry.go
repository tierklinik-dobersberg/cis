package event

import (
	"context"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

type subscription struct {
	topic      string
	subscriber string
	ch         chan<- *Event
}

type Registry struct {
	l           sync.RWMutex
	subscribers []subscription
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

	for _, sub := range reg.subscribers {
		if !MatchSubscription(id, sub.topic) {
			continue
		}

		go func(sub subscription) {
			select {
			case sub.ch <- evt:
			case <-time.After(time.Second):
				log.WithFields(logger.Fields{
					"subscriber":   sub.subscriber,
					"subscription": sub.topic,
				}).Errorf("failed to notify event subscriber")
			}
		}(sub)
	}
}

// Subscribe subscribes to events of the given eventID. All events
// fired on the registry that match the subscribed ID are published
// to the returned channel. Note that the order of events is not
// guaranteed.
func (reg *Registry) Subscribe(client, eventID string) <-chan *Event {
	reg.l.Lock()
	defer reg.l.Unlock()

	ch := make(chan *Event)
	reg.subscribers = append(reg.subscribers, subscription{
		topic:      eventID,
		subscriber: client,
		ch:         ch,
	})

	return ch
}

// Unsubscribe removes a previous subscription from client on eventID.
func (reg *Registry) Unsubscribe(client, eventID string) {
	reg.l.Lock()
	defer reg.l.Unlock()

	for idx, subscription := range reg.subscribers {
		if subscription.subscriber == client && subscription.topic == eventID {
			reg.subscribers = append(reg.subscribers[:idx], reg.subscribers[idx+1:]...)
		}
	}
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
