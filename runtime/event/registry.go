package event

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/logger"
)

var log = pkglog.New("event")

type subscription struct {
	topic      string
	subscriber string
	ch         chan<- *Event
}

// Type describes an avaialble event type.
type Type struct {
	// ID is the name of the event type
	ID string

	// Description is a human readable descriptin of
	// the event type.
	Description string
}

type TypeRef struct {
	reg *Registry
	Type
}

func (ref *TypeRef) Fire(ctx context.Context, payload Data) {
	ref.reg.Fire(ctx, ref.ID, payload)
}

type Registry struct {
	l           sync.RWMutex
	subscribers []subscription
	types       map[string]Type
}

func (reg *Registry) RegisterType(eventType Type) (*TypeRef, error) {
	reg.l.Lock()
	defer reg.l.Unlock()

	if reg.types == nil {
		reg.types = make(map[string]Type)
	}

	if _, ok := reg.types[strings.ToLower(eventType.ID)]; ok {
		return nil, fmt.Errorf("event-type: name taken")
	}

	reg.types[strings.ToLower(eventType.ID)] = eventType

	return &TypeRef{Type: eventType, reg: reg}, nil
}

func (reg *Registry) ListTypes() []Type {
	reg.l.RLock()
	defer reg.l.RUnlock()

	result := make([]Type, 0, len(reg.types))
	for _, t := range reg.types {
		result = append(result, t)
	}

	return result
}

// Fire fires a new event of the given ID to all subscribers.
func (reg *Registry) Fire(ctx context.Context, id string, payload Data) {
	reg.l.RLock()
	defer reg.l.RUnlock()

	log := log.From(ctx).WithFields(logger.Fields{
		"eventID": id,
	})

	log.Infof("fireing event")

	evt := &Event{
		ID:      id,
		Data:    payload,
		Created: time.Now(),
	}

	for _, sub := range reg.subscribers {
		l := log.WithFields(logger.Fields{
			"subscriber":   sub.subscriber,
			"subscription": sub.topic,
		})
		if !MatchSubscription(id, sub.topic) {
			// l.Infof("skipping subscriber %s, topic %s does not match %s.", sub.subscriber, sub.topic, id)

			continue
		}

		start := time.Now()
		go func(sub subscription) {
			select {
			case sub.ch <- evt:
				l.V(7).Logf("notified subscriber after %s", time.Since(start))
			case <-time.After(time.Second):
				l.Errorf("failed to notify event subscriber")
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
func Fire(ctx context.Context, id string, payload Data) {
	DefaultRegistry.Fire(ctx, id, payload)
}

// DefaultRegistry is the event registry used by package level functions.
var DefaultRegistry = new(Registry)

func MustRegisterType(t Type) *TypeRef {
	tref, err := DefaultRegistry.RegisterType(t)
	if err != nil {
		panic(fmt.Sprintf("%s: %s", t.ID, err))
	}
	return tref
}
