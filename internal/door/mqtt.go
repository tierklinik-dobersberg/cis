package door

import (
	"context"
	"encoding/json"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"github.com/tierklinik-dobersberg/logger"
)

// MqttDoor interfaces with an door controller via
// mqtt. It's meant to work with
// github.com/tierklinik-dobersberg/door-controller.git.
type MqttDoor struct {
	cli mqtt.Client
}

// NewMqttDoor connects to the MQTT server configured in cfg
// and returns a new MqttDoor interfacer.
func NewMqttDoor(client mqtt.Client) (*MqttDoor, error) {
	return &MqttDoor{
		cli: client,
	}, nil
}

// Client returns the MQTT client used.
func (door *MqttDoor) Client() mqtt.Client {
	return door.cli
}

// Lock send a lock request.
func (door *MqttDoor) Lock(ctx context.Context) error {
	return door.sendCommand(ctx, "lock")
}

// Unlock sends an unlock request.
func (door *MqttDoor) Unlock(ctx context.Context) error {
	return door.sendCommand(ctx, "unlock")
}

// Open sends an open request.
func (door *MqttDoor) Open(ctx context.Context) error {
	return door.sendCommand(ctx, "open")
}

// TODO(ppacher): move to a single topic that uses retained messages instead
// of multiple topics. This way the door-controller can pickup the last command
// automatically.
func (door *MqttDoor) sendCommand(ctx context.Context, command string) error {
	replyTo := "cliny/rpc/response/" + uuid.New().String()

	// prepare the command payload
	blob, err := json.Marshal(map[string]interface{}{
		"replyTo": replyTo,
		"command": command,
	})
	if err != nil {
		return err
	}

	// create the response channel
	ch := make(chan error, 1)

	// prepare our subscription and the handler
	token := door.cli.Subscribe(replyTo, 0, func(c mqtt.Client, m mqtt.Message) {
		select {
		case <-ctx.Done():
			return
		case ch <- nil:
		}
	})

	// Actuall subscribe to the reply token
	if token.Wait() && token.Error() != nil {
		return token.Error()
	}

	// unsubscribe again if we're done.
	defer func() {
		token := door.cli.Unsubscribe(replyTo)
		if token.Wait() && token.Error() != nil {
			logger.Errorf(ctx, "failed to unsubscribe from reply channel: %s", err)
		}
	}()

	// send the actual command
	if token := door.cli.Publish("cliny/rpc/service/door/"+command, 0, false, string(blob)); token.Wait() && token.Error() != nil {
		return token.Error()
	}

	// wait for the response or context expiration.
	select {
	case err := <-ch:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
