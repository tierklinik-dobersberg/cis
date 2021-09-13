package v1alpha

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// VoiceMailRecord represents a single voicemail record.
type VoiceMailRecord struct {
	ID             primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	From           string             `json:"from,omitempty" bson:"from,omitempty"`
	CustomerID     string             `json:"customerID,omitempty" bson:"customerID,omitempty"`
	CustomerSource string             `json:"customerSource,omitempty" bson:"customerSource,omitempty"`
	Date           time.Time          `json:"date,omitempty" bson:"date,omitempty"`
	DateStr        string             `json:"datestr,omitempty" bson:"datestr,omitempty"`
	Read           bool               `json:"read,omitempty" bson:"read,omitempty"`
	Filename       string             `json:"filename,omitempty" bson:"filename,omitempty"`
	Name           string             `json:"name,omitempty" bson:"name,omitempty"`
}
