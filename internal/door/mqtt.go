package door

import (
	"context"
	"fmt"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	runtimeMQTT "github.com/tierklinik-dobersberg/cis/runtime/mqtt"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/valyala/fasttemplate"
)

// MqttDoor interfaces with an door controller via
// mqtt. It's meant to work with
// github.com/tierklinik-dobersberg/door-controller.git.
type MqttDoor struct {
	cli *runtimeMQTT.Client

	timeout        time.Duration
	commandTopic   *fasttemplate.Template
	commandPayload *fasttemplate.Template
	responseTopic  *fasttemplate.Template
}

// NewMqttDoor connects to the MQTT server configured in cfg
// and returns a new MqttDoor interfacer.
func NewMqttDoor(client *runtimeMQTT.Client, cfg MqttConfig) (*MqttDoor, error) {
	door := &MqttDoor{
		cli:     client,
		timeout: cfg.Timeout,
	}

	var err error
	door.commandTopic, err = fasttemplate.NewTemplate(cfg.CommandTopic, "${", "}")
	if err != nil {
		return nil, fmt.Errorf("failed to parse command topic template: %w", err)
	}

	if cfg.CommandPayload != "" {
		door.commandPayload, err = fasttemplate.NewTemplate(cfg.CommandPayload, "${", "}")
		if err != nil {
			return nil, fmt.Errorf("failed to parse command payload template: %w", err)
		}
	}

	if cfg.ResponseTopic != "" {
		door.responseTopic, err = fasttemplate.NewTemplate(cfg.ResponseTopic, "${", "}")
		if err != nil {
			return nil, fmt.Errorf("failed to parse response topic template: %w", err)
		}
	}

	return door, nil
}

// Client returns the MQTT client used.
func (door *MqttDoor) Client() mqtt.Client {
	return door.cli.Client
}

// Release releases resources of the door interfacer.
func (door *MqttDoor) Release() {
	door.cli.Release()
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
	var (
		responseTopic string
		payload       string
		commandTopic  string
		err           error
	)

	var cancel context.CancelFunc
	if door.timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, door.timeout)
		defer cancel()

		// TODO(ppacher): use token.WaitTimeout() below instead of Wait()
	}

	uuid := uuid.New().String()

	commandTopic = door.commandTopic.ExecuteString(map[string]interface{}{
		"command": command,
		"uuid":    uuid,
	})
	if door.responseTopic != nil {
		responseTopic = door.responseTopic.ExecuteString(map[string]interface{}{
			"command": command,
			"uuid":    uuid,
		})
	}
	if door.commandPayload != nil {
		payload = door.commandPayload.ExecuteString(map[string]interface{}{
			"command":       command,
			"uuid":          uuid,
			"responseTopic": responseTopic,
			"commandTopic":  commandTopic,
		})
	}

	// create the response channel
	responseErrorCh := make(chan error, 1)

	// setup a topic listener if we have a response topic set
	if responseTopic != "" {
		// prepare our subscription and the handler
		token := door.cli.Subscribe(responseTopic, 0, func(c mqtt.Client, m mqtt.Message) {
			select {
			case <-ctx.Done():
				return
			case responseErrorCh <- nil:
			}
		})

		// Actuall subscribe to the reply token
		if token.Wait() && token.Error() != nil {
			return token.Error()
		}

		// unsubscribe again if we're done.
		defer func() {
			token := door.cli.Unsubscribe(responseTopic)
			if token.Wait() && token.Error() != nil {
				logger.Errorf(ctx, "failed to unsubscribe from reply channel: %s", err)
			}
		}()
	} else {
		// we don't expect a response so fill the response channel
		// so we can return immediately.
		responseErrorCh <- nil
	}

	// send the actual command
	if token := door.cli.Publish(commandTopic, 0, false, payload); token.Wait() && token.Error() != nil {
		return token.Error()
	}

	// wait for the response or context expiration.
	select {
	case err := <-responseErrorCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
