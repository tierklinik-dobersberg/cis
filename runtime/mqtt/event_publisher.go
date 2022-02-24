package mqtt

import (
	"context"
	"encoding/json"
	"fmt"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
)

type EventPublisher struct {
	ConnectionName   string
	TopicPrefix      string
	EventAsTopic     bool
	QualityOfService int

	cs *runtime.ConfigSchema
}

func getConnectedClient(ctx context.Context, name string, cs *runtime.ConfigSchema) (mqtt.Client, error) {
	var mqttConfigs []ConnectionConfig

	if err := cs.DecodeSection(ctx, "MQTT", &mqttConfigs); err != nil {
		return nil, fmt.Errorf("failed to decode mqtt configuration sections")
	}

	if len(mqttConfigs) == 0 {
		return nil, fmt.Errorf("no mqtt configuration defined")
	}

	var selectedConfig ConnectionConfig
	if name != "" {
		for _, cfg := range mqttConfigs {
			if cfg.Name == name {
				selectedConfig = cfg
				break
			}
		}
	} else {
		selectedConfig = mqttConfigs[0]
	}

	cli, err := selectedConfig.GetClient(ctx)
	if err != nil {
		return nil, err
	}

	if token := cli.Connect(); token.Wait() && token.Error() != nil {
		return nil, token.Error()
	}

	return cli, nil
}

// HandleEvent implements (event.Handler).
func (pub *EventPublisher) HandleEvents(ctx context.Context, evts ...*event.Event) error {
	cli, err := getConnectedClient(ctx, pub.ConnectionName, pub.cs)
	if err != nil {
		return err
	}
	defer cli.Disconnect(1000)

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
