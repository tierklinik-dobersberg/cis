package schema

import (
	"context"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
)

// MqttConfig groups all MQTT related configuration settings.
type MqttConfig struct {
	MqttServer           []string
	MqttClientID         string
	MqttKeepAliveSeconds int
	MqttUser             string
	MqttPassword         string
}

// MqttSpec defines all allowed MQTT configuration stanzas.
var MqttSpec = conf.SectionSpec{
	{
		Name:        "MqttServer",
		Type:        conf.StringSliceType,
		Description: "Mqtt server address",
		Required:    true,
	},
	{
		Name:        "MqttClientID",
		Type:        conf.StringType,
		Default:     "cisd",
		Description: "Client ID for mqtt",
	},
	{
		Name:        "MqttKeepAliveSeconds",
		Type:        conf.IntType,
		Description: "Number of seconds for MQTT keep-alive",
		Default:     "60",
	},
	{
		Name:        "MqttUser",
		Type:        conf.StringType,
		Description: "Username for MQTT server",
	},
	{
		Name:        "MqttPassword",
		Type:        conf.StringType,
		Description: "Password for MQTT server",
	},
}

// GetClient returns a new MQTT client based on the configuration settings
// in cfg.
func (cfg MqttConfig) GetClient(ctx context.Context) (mqtt.Client, error) {
	opts := mqtt.NewClientOptions()
	for _, srv := range cfg.MqttServer {
		opts.AddBroker(srv)
	}

	opts.SetClientID(cfg.MqttClientID)

	if cfg.MqttUser != "" {
		opts.SetUsername(cfg.MqttUser)
		opts.SetPassword(cfg.MqttPassword)
	}

	opts.SetAutoReconnect(true)

	// TODO(ppacher): do we need a default handler?
	// opts.SetDefaultPublishHandler(messagePubHandler)

	opts.OnConnect = func(cli mqtt.Client) {
		logger.Infof(ctx, "connected to MQTT server")
	}

	opts.OnConnectionLost = func(cli mqtt.Client, err error) {
		logger.Errorf(ctx, "lost connection to MQTT server: %s", err.Error())
	}

	client := mqtt.NewClient(opts)
	return client, nil
}
