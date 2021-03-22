package trigger

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

func init() {
	autodoc.MustRegister(autodoc.File{
		Name:           ".trigger",
		Multiple:       true,
		LookupPaths:    []string{},
		DropinsAllowed: false,
		Sections:       map[string]conf.OptionRegistry{"Match": MatchSpec},
		LazySectionsFunc: func() map[string]conf.OptionRegistry {
			DefaultRegistry.l.RLock()
			defer DefaultRegistry.l.RUnlock()
			m := make(map[string]conf.OptionRegistry)
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

		# And trigger actions as sepearte section below.
		`,
	})
}
