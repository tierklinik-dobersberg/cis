package mqtt

import (
	"context"
	"encoding/json"

	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
)

type EventPublisher struct {
	ConnectionName   string
	TopicPrefix      string
	EventAsTopic     bool
	QualityOfService int

	cm *ConnectionManager
}

// HandleEvent implements (event.Handler).
func (pub *EventPublisher) HandleEvents(ctx context.Context, evts ...*event.Event) error {
	cli, err := pub.cm.Client(ctx, pub.ConnectionName)
	if err != nil {
		return err
	}
	defer cli.Release()

	errors := new(multierr.Error)
	for _, evt := range evts {
		blob, err := json.Marshal(evt)
		if err != nil {
			errors.Addf("failed to publish: json: %w", err)
			log.From(ctx).Errorf("failed to publish event: json: %s", err)

			continue
		}

		topic := pub.TopicPrefix
		if pub.EventAsTopic {
			topic += evt.ID
		}

		if token := cli.Publish(topic, byte(pub.QualityOfService), false, blob); token.Wait() && token.Error() != nil {
			errors.Addf("failed to publish: %w", token.Error())
			log.From(ctx).Errorf("failed to publish event on MQTT: %s", token.Error())
		}
	}

	return errors.ToError()
}
