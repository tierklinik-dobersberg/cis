package v1alpha

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Day describes the doctors on duty for a single
// day.
type Day struct {
	// Forenoon is a list of usernames that are in duty before lunch.
	Forenoon []string `bson:"forenoon,omitempty" json:"forenoon,omitempty"`

	// Afternoon is a list of usernames that are in duty after lunch.
	Afternoon []string `bson:"afternoon,omitempty" json:"afternoon,omitempty"`

	// List of usernames that are responsible for handling
	// emergencies after office-hours.
	// Later usernames serving as the backup for the previous
	// one.
	Emergency []string `bson:"emergency,omitempty" json:"emergency,omitempty"`
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
