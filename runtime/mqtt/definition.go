package mqtt

import (
	"context"
	"fmt"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

var (
	configBuilder = runtime.NewConfigSchemaBuilder(addMqttSchema)
	AddToSchema   = configBuilder.AddToSchema
)

// ConnectionConfig groups all MQTT related configuration settings.
type ConnectionConfig struct {
	Name             string
	Server           []string
	ClientID         string
	KeepAliveSeconds int
	User             string
	Password         string
}

// ConnectionConfigSpec defines all allowed MQTT configuration stanzas.
var ConnectionConfigSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Type:        conf.StringType,
		Description: "The name of the connection mainly used in references.",
		Required:    true,
	},
	{
		Name:        "Server",
		Type:        conf.StringSliceType,
		Description: "Mqtt server address",
		Required:    true,
	},
	{
		Name:        "ClientID",
		Type:        conf.StringType,
		Default:     "cisd",
		Description: "Client ID for mqtt",
	},
	{
		Name:        "KeepAliveSeconds",
		Type:        conf.IntType,
		Description: "Number of seconds for MQTT keep-alive",
		Default:     "60",
	},
	{
		Name:        "User",
		Type:        conf.StringType,
		Description: "Username for MQTT server",
	},
	{
		Name:        "Password",
		Type:        conf.StringType,
		Description: "Password for MQTT server",
		Annotations: new(conf.Annotation).With(
			conf.SecretValue(),
		),
	},
}

// GetClient returns a new MQTT client based on the configuration settings
// in cfg.
func (cfg ConnectionConfig) GetClient(ctx context.Context) (mqtt.Client, error) {
	opts := mqtt.NewClientOptions()
	for _, srv := range cfg.Server {
		opts.AddBroker(srv)
	}

	opts.SetClientID(cfg.ClientID)

	if cfg.User != "" {
		opts.SetUsername(cfg.User)
		opts.SetPassword(cfg.Password)
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

var testSpec = conf.SectionSpec{
	{
		Name:        "Topic",
		Type:        conf.StringType,
		Required:    true,
		Description: "The Topic name to publish a message to",
	},
	{
		Name:        "Payload",
		Type:        conf.StringType,
		Required:    true,
		Default:     "test-message",
		Description: "The payload for the message",
	},
}

func addMqttSchema(cs *runtime.ConfigSchema) error {
	return cs.Register(runtime.Schema{
		Name:        "MQTT",
		DisplayName: "MQTT",
		Description: "Configure MQTT connections for integration with external systems",
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />`,
		Spec:        ConnectionConfigSpec,
		Multi:       true,
		Annotations: new(conf.Annotation).With(
			runtime.Unique("Name"),
			runtime.OverviewFields("Name", "Server", "User", "ClientID"),
		),
		Tests: []runtime.ConfigTest{
			{
				ID:   "test-publish-topic",
				Name: "Publish a message",
				Spec: testSpec,
				TestFunc: func(ctx context.Context, config, testConfig []conf.Option) (*runtime.TestResult, error) {
					var cfg struct {
						Topic   string
						Payload string
					}

					if err := conf.DecodeSections(
						conf.Sections{
							{
								Name:    "TestConfig",
								Options: testConfig,
							},
						},
						testSpec,
						&cfg,
					); err != nil {
						return nil, err
					}

					var connDetails ConnectionConfig
					if err := conf.DecodeSections(
						[]conf.Section{
							{
								Name:    "MQTT",
								Options: config,
							},
						},
						ConnectionConfigSpec,
						&connDetails,
					); err != nil {
						return nil, err
					}

					cli, err := connDetails.GetClient(ctx)
					if err != nil {
						return nil, err
					}
					if token := cli.Connect(); token.Wait() && token.Error() != nil {
						// trunk-ignore(golangci-lint/nilerr)
						return runtime.NewTestError(
							fmt.Errorf("failed to connect: %w", token.Error()),
						), nil
					}
					defer cli.Disconnect(1000)

					if token := cli.Publish(cfg.Topic, 0, false, cfg.Payload); token.Wait() && token.Error() != nil {
						// trunk-ignore(golangci-lint/nilerr)
						return runtime.NewTestError(
							fmt.Errorf("failed to publish: %w", token.Error()),
						), nil
					}

					return nil, nil
				},
			},
		},
	})
}
