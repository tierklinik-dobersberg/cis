package v1alpha

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CallLog represents an incoming call.
type CallLog struct {
	ID primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	// Caller is the calling phone number.
	Caller string `json:"caller" bson:"caller,omitempty"`
	// InboundNumber is the called number.
	InboundNumber string `json:"inboundNumber" bson:"inboundNumber,omitempty"`
	// Date holds the exact date the call was recorded.
	Date time.Time `json:"date" bson:"date,omitempty"`
	// DurationSeconds is the duration in seconds the call took.
	DurationSeconds uint64 `json:"durationSeconds,omitempty" bson:"durationSeconds,omitempty"`
	// The call type.
	CallType string `json:"callType,omitempty" bson:"callType,omitempty"`
	// DateStr holds a string representation of the date in
	// the format of YYYY-MM-DD for indexing.
	DateStr string `json:"datestr" bson:"datestr,omitempty"`
	// Agent is the agent that participated in the call
	Agent string `json:"agent,omitempty" bson:"agent,omitempty"`
	// CustomerID is the ID of the customer that participated in the call.
	CustomerID string `json:"customerID,omitempty" bson:"customerID,omitempty"`
	// CustomerSource is the source of the customer record.
	CustomerSource string `json:"customerSource,omitempty" bson:"customerSource,omitempty"`
	// Error might be set to true if an error occured during transfer of the call.
	// The exact error is unknown and should be investigated by an administrator.
	Error bool `json:"error,omitempty" bson:"error,omitempty"`
	// TransferTarget is set to the destination of call transfer.
	TransferTarget string `json:"transferTarget,omitempty" bson:"transferTarget,omitempty"`
}
