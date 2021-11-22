package v1alpha

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// OnCall defines who is on-call during day and night. Those
// are used to determine who is responsible of handling emergencies
// or other duties after office-hours.
type OnCall struct {
	Day   []string `bson:"day,omitempty" json:"day,omitempty"`
	Night []string `bson:"night,omitempty" json:"night,omitempty"`
}

// Day describes the doctors on duty for a single
// day.
type Day struct {
	// Forenoon is a list of usernames that are in duty before lunch.
	Forenoon []string `bson:"forenoon,omitempty" json:"forenoon"`

	// Afternoon is a list of usernames that are in duty after lunch.
	Afternoon []string `bson:"afternoon,omitempty" json:"afternoon"`

	// OnCall holds duty information for the day and night shift of
	// the respective day.
	OnCall OnCall `bson:"onCall,omitempty" json:"onCall"`
}

// DutyRoster describes the doctors on duty for one month.
type DutyRoster struct {
	// ID is the ID of the duty roster stored in the MongoDB collection.
	ID primitive.ObjectID `bson:"_id,omitempty" json:"-"`

	// Month the duty roster is for.
	Month time.Month `bson:"month,omitempty" json:"month,omitempty"`

	// Year of the duty roster.
	Year int `bson:"year,omitempty" json:"year,omitempty"`

	// Days holds a map of individual days of the duty roster.
	Days map[int]Day `bson:"days,omitempty" json:"days,omitempty"`
}

// Overwrite defines an overwrite for the emergency doctor-on-duty
// at a given date.
type Overwrite struct {
	// ID is the a unique ID of the overwrite
	ID primitive.ObjectID `bson:"_id,omitempty" json:"-"`

	// From holds the datetime at which the overwrite is considered active.
	From time.Time `bson:"from" json:"from"`

	// To holds teh datetime at which the overwrite should not be considered active
	// anymore.
	To time.Time `bson:"to" json:"to"`

	// Username is the name of the CIS user that is in duty instead.
	Username string `bson:"username,omitempty" json:"username,omitempty"`

	// PhoneNumber is the phone-number that is in duty instead.
	PhoneNumber string `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`

	// DisplayName can be set to a arbitrary value and is used for UI display purposes when
	// duty is changed to a phone-number instead of a user.
	DisplayName string `bson:"displayName,omitempty" json:"displayName,omitempty"`

	// Deleted is set to true if this overwrite has been deleted or superseded.
	Deleted bool `bson:"deleted,omitempty" json:"deleted,omitempty"`

	// CreatedBy is set to the name of the CIS user that created the overwrite.
	CreatedBy string `bson:"createdBy,omitempty" json:"createdBy,omitempty"`

	// CreatedAt holds the time at which the overwrite has been created.
	CreatedAt time.Time `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
}
