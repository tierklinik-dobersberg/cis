package mqtt

import (
	"context"
	"fmt"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

// TODO(ppacher):
//	- add support for connection pooling so we don't re-create for each "publish"

var log = pkglog.New("mqtt")

var TriggerSpec = conf.SectionSpec{
	{
		Name:        "ConnectionName",
		Description: "The name of the MQTT connection configuration. Defaults to the first configuration.",
		Type:        conf.StringType,
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRef("MQTT", runtime.IDRef, "name"),
		),
	},
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

// RegisterTriggerOn registers the MQTT trigger on the registry reg.
func RegisterTriggerOn(reg *trigger.Registry) error {
	return reg.RegisterType("mqtt-publish", &trigger.Type{
		OptionRegistry: TriggerSpec,
		CreateFunc: func(ctx context.Context, globalCfg *runtime.ConfigSchema, sec *conf.Section) (trigger.Handler, error) {
			pub := &EventPublisher{
				cs: globalCfg,
			}

			if err := conf.DecodeSections([]conf.Section{*sec}, TriggerSpec, pub); err != nil {
				return nil, fmt.Errorf("failed to parse section: %w", err)
			}

			return pub, nil
		},
	})
}

func init() {
	runtime.Must(
		RegisterTriggerOn(trigger.DefaultRegistry),
	)
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
