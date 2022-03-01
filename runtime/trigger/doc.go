// Package trigger adds a ppacher/system-conf based trigger system
// that listens for events from cis/runtime/events. It provides
// basic debouncing and buffering of events per trigger definition.
// The package itself does not contain actual event handlers but
// supports a simple registry-style pattern to register your own
// trigger types.
//
//   func init() {
//     	trigger.RegisterType(trigger.Type{
//        OptionRegistry: conf.SectionSpec{
//        	{
//        		Name: "SomeConfig",
//        		Type: conf.StringType,
//        	},
//        },
//        Name: "MyHandler",
//        CreateFunc: func(ctx context.Context, _ *runtime.ConfigSchema, sec *conf.Section) (trigger.Handler, error) {
//           return &MyHandler{}, nil
//        }
//      })
//   }
//
// The above example might later be used in a .trigger file definition
// like so:
//
//   [Match]
//   EventFilter=event/topic/#
//   DebounceUntil=12:00
//   DebounceUntil=17:00
//
//   [MyHandler]
//   SomeConfig=some value
//
// The trigger package also registers an autodoc.File for the DefaultRegistry
// so documentation for available trigger types is built into the final binary.
package trigger

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/autodoc"
)

// MatchSpec defines all configuration stanzas that can be used
// to configure event matching for trigger instances. MatchSpec
// is only used with file based trigger configuration.
// See Registry for more information on file based trigger
// configuration.
var MatchSpec = conf.SectionSpec{
	{
		Name:        "EventFilter",
		Type:        conf.StringSliceType,
		Aliases:     []string{"Event"},
		Description: "A event subscription topic",
		Default:     "#",
	},
	{
		Name:        "BufferUntil",
		Type:        conf.StringSliceType,
		Description: "Buffer events and emit then at defined times. Accepts HH:MM values.",
	},
	{
		Name:        "DebounceUntil",
		Type:        conf.StringSliceType,
		Description: "Like BufferUntil but only remembers the last event emitted.",
	},
	{
		Name:        "Description",
		Type:        conf.StringType,
		Description: "A human readable description of the trigger",
	},
	{
		Name:        "Group",
		Type:        conf.StringSliceType,
		Description: "A list of groups this trigger belongs to",
	},
}

func init() {
	// we don't need the file reference here as Registry does implement
	// (conf.SectionRegistry) itself.
	autodoc.MustRegister(autodoc.File{
		Name:           ".trigger",
		Multiple:       true,
		LookupPaths:    []string{},
		DropinsAllowed: false,
		Sections:       conf.FileSpec{"Match": MatchSpec},
		LazySectionsFunc: func() conf.FileSpec {
			DefaultRegistry.l.RLock()
			defer DefaultRegistry.l.RUnlock()
			m := make(conf.FileSpec)
			for name, factory := range DefaultRegistry.factories {
				m[name] = factory.Spec
			}

			return m
		},
		Description: "Trigger can be used to perform actions whenever an internal event is fired. They are mainly useful to integrate with external systems.",
		Example: `
			[Match]
			EventFilter=event/roster/#
			Description=Forward updates to the dutyroster to MQTT
			Group=some-group-name

			[MQTT-Publish]
			EventAsTopic=yes
			TopicPrefix=cis
			`,
		ExampleDescription: "Publishes all roster updates on MQTT.",
		Template: `
			[Match]
			EventFilter=
			# BufferUntil=
			# DebounceUntil=

			# Add trigger actions as separate section below.
			`,
	})
}
