package schema

import "github.com/ppacher/system-conf/conf"

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
