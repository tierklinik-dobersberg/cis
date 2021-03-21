package event

import "strings"

// MatchSubscription checks if topic matches the subscription.
// Topics are modelled after MQTT topics and are separated
// by using forward slashes. A '#' denotes a wildcard that matches
// the rest of the topic while '*' can be used as a wildcard that
// only matches the current field.
func MatchSubscription(topic string, subscription string) bool {
	topicParts := strings.Split(topic, "/")
	subscriptionParts := strings.Split(subscription, "/")

	for idx, part := range subscriptionParts {
		// if part is a "#" wildcard we have a match here
		if part == "#" {
			return true
		}

		// * is a "this-field only" wildcard so we need to continue
		// checking the next field
		if part == "*" {
			continue
		}

		if len(topicParts) <= idx {
			return false
		}

		if topicParts[idx] != part {
			return false
		}
	}

	return true
}
