package door

import (
	"context"
	"fmt"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/mqtt"
)

var (
	configBuilder = runtime.NewConfigSchemaBuilder(addDoorSchema)
	AddToSchema   = configBuilder.AddToSchema
)

type MqttConfig struct {
	ConnectionName string
	CommandTopic   string
	CommandPayload string
	ResponseTopic  string
	Timeout        time.Duration
}

var Spec = conf.SectionSpec{
	{
		Name:        "ConnectionName",
		Required:    true,
		Type:        conf.StringType,
		Description: "The name of the MQTT connection.",
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRef("MQTT", "Name", "Name"),
		),
	},
	{
		Name:        "CommandTopic",
		Type:        conf.StringType,
		Description: "The MQTT topic to publish the command to.",
		Default:     "cliny/rpc/service/door/${command}",
	},
	{
		Name:        "CommandPayload",
		Type:        conf.StringType,
		Description: "The payload to publish to the command topic",
		Default:     `{"replyTo": "${responseTopic}", "command": "${command}"}`,
		Annotations: new(conf.Annotation).With(
			runtime.StringFormat("text/plain"),
		),
	},
	{
		Name:        "ResponseTopic",
		Type:        conf.StringType,
		Description: "If a response is expected, this should be set to the topic which receives the response",
		Default:     "cliny/rpc/response/${uuid}",
	},
	{
		Name:        "Timeout",
		Type:        conf.DurationType,
		Description: "The maximum amount of time to wait for a response.",
		Default:     "2s",
	},
}

var testSpec = conf.SectionSpec{
	{
		Name:        "Action",
		Required:    true,
		Type:        conf.StringType,
		Description: "The action to perform",
		Annotations: new(conf.Annotation).With(
			runtime.OneOf(
				runtime.PossibleValue{
					Value:   "lock",
					Display: "Lock",
				},
				runtime.PossibleValue{
					Value:   "unlock",
					Display: "Unlock",
				},
				runtime.PossibleValue{
					Value:   "open",
					Display: "Open",
				},
			),
		),
	},
}

func addDoorSchema(runtimeConfig *runtime.ConfigSchema) error {
	return runtimeConfig.Register(runtime.Schema{
		Name:        "Door",
		DisplayName: "Door Controller",
		Description: "Configure the door controller",
		SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />`,
		Spec:        Spec,
		Multi:       false,
		Tests: []runtime.ConfigTest{
			{
				ID:   "test-door",
				Name: "Test MQTT Door",
				Spec: testSpec,
				TestFunc: func(ctx context.Context, config, testConfig []conf.Option) (*runtime.TestResult, error) {
					door, err := getTestDoor(ctx, runtimeConfig, config)
					if err != nil {
						return runtime.NewTestError(err), nil
					}
					defer door.Release()

					action, err := conf.Options(testConfig).GetString("Action")
					if err != nil {
						return runtime.NewTestError(err), nil
					}

					switch action {
					case "lock":
						err = door.Lock(ctx)
					case "unlock":
						err = door.Unlock(ctx)
					case "open":
						err = door.Open(ctx)
					}

					if err != nil {
						return runtime.NewTestError(err), nil
					}

					return nil, nil
				},
			},
		},
	})
}

func getTestDoor(ctx context.Context, cs *runtime.ConfigSchema, config []conf.Option) (*MqttDoor, error) {
	connectionManager := mqtt.NewConnectionManager(cs)

	var cfg MqttConfig
	if err := conf.DecodeSections(
		conf.Sections{
			{
				Name:    "MQTT-Config",
				Options: config,
			},
		},
		Spec,
		&cfg,
	); err != nil {
		return nil, fmt.Errorf("failed to decode configuration: %w", err)
	}

	cli, err := connectionManager.ClientWithRandomID(ctx, cfg.ConnectionName)
	if err != nil {
		return nil, err
	}

	door, err := NewMqttDoor(cli, cfg)
	if err != nil {
		return nil, err
	}

	return door, nil
}

func init() {
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
