package mqtt

import (
	"context"
	"encoding/json"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/logger"
)

type EventPublisher struct {
	Client           mqtt.Client
	EventFilter      string
	InstanceName     string
	TopicPrefix      string
	QualityOfService int
	Registry         *event.Registry
}

// Start starts publishing events on MQTT until the provided context
// is cancelled.
func (pub *EventPublisher) Start(ctx context.Context) {
	go func() {
		<-ctx.Done()
	}()

	events := pub.Registry.Subscribe(pub.InstanceName, pub.EventFilter)

	go func() {
		defer pub.Registry.Unsubscribe(pub.InstanceName, pub.EventFilter)

		for {
			select {
			case evt := <-events:
				blob, err := json.Marshal(evt)
				if err != nil {
					logger.From(ctx).Errorf("failed to publish event: json: %s", err)
					continue
				}

				topic := pub.TopicPrefix + evt.ID
				if token := pub.Client.Publish(topic, byte(pub.QualityOfService), false, blob); token.Wait() && token.Error() != nil {
					logger.From(ctx).Errorf("failed to publish event on MQTT: %s", token.Error())
				}
			case <-ctx.Done():
				return
			}
		}
	}()
}
