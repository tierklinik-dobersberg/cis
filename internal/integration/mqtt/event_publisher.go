package mqtt

import (
	"context"
	"encoding/json"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/logger"
)

type EventPublisher struct {
	TopicPrefix      string
	EventAsTopic     bool
	QualityOfService int
	cli              mqtt.Client
}

// HandleEvent implements (event.Handler).
func (pub *EventPublisher) HandleEvent(ctx context.Context, evt *event.Event) {
	blob, err := json.Marshal(evt)
	if err != nil {
		logger.From(ctx).Errorf("failed to publish event: json: %s", err)
		return
	}

	topic := pub.TopicPrefix
	if pub.EventAsTopic {
		topic += evt.ID
	}

	if token := pub.cli.Publish(topic, byte(pub.QualityOfService), false, blob); token.Wait() && token.Error() != nil {
		logger.From(ctx).Errorf("failed to publish event on MQTT: %s", token.Error())
	}
}
