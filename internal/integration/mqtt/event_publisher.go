package mqtt

import (
	"context"
	"encoding/json"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/tierklinik-dobersberg/cis/internal/event"
)

type EventPublisher struct {
	TopicPrefix      string
	EventAsTopic     bool
	QualityOfService int
	cli              mqtt.Client
}

// HandleEvent implements (event.Handler).
func (pub *EventPublisher) HandleEvents(ctx context.Context, evts ...*event.Event) {
	for _, evt := range evts {

		blob, err := json.Marshal(evt)
		if err != nil {
			log.From(ctx).Errorf("failed to publish event: json: %s", err)
			continue
		}

		topic := pub.TopicPrefix
		if pub.EventAsTopic {
			topic += evt.ID
		}

		if token := pub.cli.Publish(topic, byte(pub.QualityOfService), false, blob); token.Wait() && token.Error() != nil {
			log.From(ctx).Errorf("failed to publish event on MQTT: %s", token.Error())
		}
	}
}
