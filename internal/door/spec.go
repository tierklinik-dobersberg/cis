package door

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var (
	configBuilder = runtime.NewConfigSchemaBuilder(addDoorSchema)
	AddToSchema   = configBuilder.AddToSchema
)

type DoorConfig struct {
	Type            string
	ShellyScriptURL string
}

var Spec = conf.SectionSpec{
	{
		Name:        "Type",
		Required:    true,
		Default:     "disabled",
		Description: "The type of door interface to use",
		Type:        conf.StringType,
		Annotations: new(conf.Annotation).With(
			runtime.OneOf(
				runtime.PossibleValue{
					Display: "Shelly Pro 2 (provided script)",
					Value:   "shelly-script",
				},
				runtime.PossibleValue{
					Display: "Disabled",
					Value:   "disabled",
				},
			),
		),
	},
	{
		Name:        "ShellyScriptURL",
		Type:        conf.StringType,
		Description: "The URL to start the provided shelly script. Used only if Type is set to Shelly Pro 2",
		Default:     "http://localhost/scripts/1/door",
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

func getTestDoor(ctx context.Context, cs *runtime.ConfigSchema, config []conf.Option) (Interfacer, error) {
	var cfg DoorConfig
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

	switch cfg.Type {

	case "shelly-script":
		door := &ShellyScriptDoor{
			url: cfg.ShellyScriptURL,
		}

		return door, nil

	case "disabled":
		return nil, fmt.Errorf("door control is disabled")

	default:
		return nil, fmt.Errorf("invalid door interface type: %q", cfg.Type)

	}
}

func init() {
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
