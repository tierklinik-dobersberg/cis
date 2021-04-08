package trigger

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

// MatchSpec defines all configuration stanzas that
// are available in each [Match] section
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
				m[name] = factory
			}
			return m
		},
		Description: "Trigger can be used to perform actions whenever an internal event is fired. They are mainly useful to integrate with external systems.",
		Example: `
			[Match]
			EventFilter=event/roster/#

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

			# Add trigger actions as sepearte section below.
			`,
	})
}
