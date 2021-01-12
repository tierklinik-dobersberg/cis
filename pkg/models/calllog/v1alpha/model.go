package v1alpha

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CallLog represents an incoming call.
type CallLog struct {
	ID primitive.ObjectID `json:"_id,omitempty"`
	// Caller is the calling phone number.
	Caller string `json:"caller"`
	// InboundNumber is the called number.
	InboundNumber string `json:"inboundNumber"`
	// Date holds the exact date the call was recorded.
	Date time.Time `json:"date"`
	// DateStr holds a string representation of the date in
	// the format of YYYY-MM-DD for indexing.
	DateStr string `json:"dateStr"`
}
