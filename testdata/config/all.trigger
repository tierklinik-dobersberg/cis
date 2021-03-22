[Match]
# We match all events that are prefixed with
# event/ here
EventFilter=event/#

[MQTT-Publish]
# MQTT-Publish uses the global MQTT client that is always available.
# Connecting to a different mqtt broker is not yet supported. File an
# issue if you would like to see support for that.
QualityOfService=0
TopicPrefix=cis/
EventAsTopic=yes
