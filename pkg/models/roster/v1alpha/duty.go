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

	// Days holds a map of individual day of the duty roster.
	Days map[int]Day `bson:"days,omitempty" json:"days,omitempty"`
}

// Overwrite defines an overwrite for the emergency doctor-on-duty
// at a given date.
type Overwrite struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"-"`
	Date        string             `bson:"date,omitempty" json:"date"` // YYYY-MM-DD
	Username    string             `bson:"username,omitempty" json:"username,omitempty"`
	PhoneNumber string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	DisplayName string             `bson:"displayName,omitempty" json:"displayName,omitempty"`
	Deleted     bool               `bson:"deleted,omitempty" json:"-"`
	CreatedBy   string             `bson:"createdBy,omitempty" json:"createdBy,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
}
