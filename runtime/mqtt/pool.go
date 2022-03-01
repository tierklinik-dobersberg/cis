package mqtt

import (
	"context"
	"fmt"
	"sync"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type (
	ConnectionManager struct {
		r       sync.Mutex
		clients map[string]*Client
		config  *runtime.ConfigSchema
	}

	Client struct {
		mqtt.Client

		id    string
		count uint64
		cm    *ConnectionManager
	}
)

// NewConnectionManager returns a new MQTT connection manager.
func NewConnectionManager(cs *runtime.ConfigSchema) *ConnectionManager {
	return &ConnectionManager{
		clients: make(map[string]*Client),
		config:  cs,
	}
}

// ClientWithRandomID returns a new, connected MQTT client created from the configration
// identified by name. The ID of the client is a random string to not interfer with other
// instances of the above configuration
func (cm *ConnectionManager) ClientWithRandomID(ctx context.Context, name string) (*Client, error) {
	randomID, err := utils.Nonce(16)
	if err != nil {
		return nil, err
	}

	return cm.newClient(ctx, name, randomID)
}

func (cm *ConnectionManager) Client(ctx context.Context, name string) (*Client, error) {
	cm.r.Lock()
	defer cm.r.Unlock()

	// return the existing client if we have on
	if cli, ok := cm.clients[name]; ok {
		cli.count++

		return cli, nil
	}

	cli, err := cm.newClient(ctx, name, "")
	if err != nil {
		return nil, err
	}

	cm.clients[name] = cli

	return cli, nil
}

func (cli *Client) Release() {
	cli.cm.r.Lock()
	defer cli.cm.r.Unlock()

	if cli.count == 0 {
		panic("MQTT client reference counter dropped below zero. name=" + cli.id)
	}

	cli.count--
	if cli.count == 0 {
		cli.Client.Disconnect(1000)
		delete(cli.cm.clients, cli.id)
	}
}

func (cm *ConnectionManager) newClient(ctx context.Context, name string, idOverwrite string) (*Client, error) {
	// search for the expected MQTT configuration
	var mqttConfigs []ConnectionConfig
	if err := cm.config.DecodeSection(ctx, "MQTT", &mqttConfigs); err != nil {
		return nil, fmt.Errorf("failed to get mqtt connection configuration for %s: %w", name, err)
	}

	var mqttConfig *ConnectionConfig
	for idx := range mqttConfigs {
		if mqttConfigs[idx].Name == name {
			mqttConfig = &mqttConfigs[idx]

			break
		}
	}

	if mqttConfig == nil {
		return nil, fmt.Errorf("unknown MQTT configuration %s", name)
	}

	if idOverwrite != "" {
		mqttConfig.ClientID = name
	}

	mqttClient, err := mqttConfig.GetClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create mqtt client for %s: %w", name, err)
	}

	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		return nil, fmt.Errorf("failed to connect to mqtt broken in connection %s: %w", name, token.Error())
	}

	cli := &Client{
		count:  1,
		id:     name,
		cm:     cm,
		Client: mqttClient,
	}

	return cli, nil
}

// DefaultConnectionManager is the default connection manager that keeps track of
// configured and established MQTT connections. Note that the DefaultConnectionManager
// is bound to runtime.GlobalSchema!
var DefaultConnectionManager = NewConnectionManager(runtime.GlobalSchema)
