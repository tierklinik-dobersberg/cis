// Package trigger adds a ppacher/system-conf based trigger system
// that listens for events from cis/runtime/events. It provides
// basic debouncing and buffering of events per trigger definition.
// The package itself does not contain actual event handlers but
// supports a simple registry-style pattern to register your own
// trigger types.
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
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

// MatchSpec defines all configuration stanzas that can be used
// to configure event matching for trigger instances. MatchSpec
// is only used with file based trigger configuration.
// See Registry for more information on file based trigger
// configuration.
var MatchSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Type:        conf.StringType,
		Required:    true,
		Description: "The name of the trigger instance.",
	},
	{
		Name:        "Description",
		Type:        conf.StringType,
		Description: "A human readable description of the trigger.",
	},
	{
		Name:        "EventFilter",
		Type:        conf.StringSliceType,
		Aliases:     []string{"Event"},
		Description: "A event subscription topic",
		Default:     "#",
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRef("events", "ID", "Description", true),
		),
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
		Name:        "Group",
		Type:        conf.StringSliceType,
		Description: "A list of groups this trigger belongs to.",
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRef("trigger", "Group", "Group", true),
		),
	},
}

var triggerRefSpec = conf.SectionSpec{
	{
		Name: "Action",
		Type: conf.StringSliceType,
	},
}

var (
	configBuilder = runtime.NewConfigSchemaBuilder(addTriggerSpec)
	AddToSchema   = configBuilder.AddToSchema
)

func addTriggerSpec(cs *runtime.ConfigSchema) error {
	return cs.Register(runtime.Schema{
		Name:     "TriggerInstance",
		Internal: true,
		Spec: confutil.MultiOptionRegistry{
			MatchSpec,
			triggerRefSpec,
		},
		Annotations: new(conf.Annotation).With(
			runtime.Unique("Name"),
		),
	})
}

func init() {
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
