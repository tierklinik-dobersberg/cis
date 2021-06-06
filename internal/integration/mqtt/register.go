package mqtt

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/service/runtime"
)

var log = pkglog.New("mqtt")

var Spec = conf.SectionSpec{
	{
		Name:        "TopicPrefix",
		Description: "Prefix for the event topic",
		Type:        conf.StringType,
		Aliases:     []string{"Topic"},
	},
	{
		Name:        "EventAsTopic",
		Description: "Whether or not the event ID is used as a topic. If false, TopicPrefix or Topic must be set.",
		Type:        conf.BoolType,
		Default:     "yes",
	},
	{
		Name:        "QualityOfService",
		Description: "The QoS to use when publishing messages",
		Type:        conf.IntType,
		Default:     "0",
	},
}

// RegisterTriggerOn registeres the MQTT trigger on the registry reg.
func RegisterTriggerOn(reg *trigger.Registry) error {
	return reg.RegisterType("mqtt-publish", &trigger.Type{
		OptionRegistry: Spec,
		CreateFunc: func(ctx context.Context, globalCfg *runtime.ConfigSchema, sec *conf.Section) (trigger.Handler, error) {
			app := app.FromContext(ctx)
			if app == nil {
				return nil, fmt.Errorf("expected App to be set on ctx")
			}

			if app.MQTTClient == nil {
				return nil, fmt.Errorf("no MQTT connection defined in [Global]")
			}

			pub := &EventPublisher{
				cli: app.MQTTClient,
			}
			if err := conf.DecodeSections([]conf.Section{*sec}, Spec, pub); err != nil {
				return nil, fmt.Errorf("failed to parse section: %w", err)
			}

			return pub, nil
		},
	})
}

func init() {
	runtime.Must(RegisterTriggerOn(trigger.DefaultRegistry))
}
