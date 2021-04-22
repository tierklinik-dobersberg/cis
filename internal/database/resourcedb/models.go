package resourcedb

import "time"

type UseRecord struct {
	// ResourceName is the name of the resource that this
	// record belongs to.
	ResourceName string `json:"resourceName" bson:"resourceName"`

	// UsedByUser holds the name of the user that requested
	// use of this resource in the time-frame specified by
	// this use-record. Note for use-records that have Origin == "calendar"
	// the UsedByUser field may also specify the calendar-id that
	// references this use-record.
	UsedByUser string `json:"userName" bson:"userName,omitempty"`

	// Origin holds the origin of the use-record. This is more for
	// auditing purposes and might be set to something like "user",
	// "calendar" or anything else that can create resource use-records.
	Origin string

	// Metadata might contain arbitrary metadata about the use record.
	// The exact keys and values depend on the use-record origin.
	Metadata map[string]interface{}

	// StartTime defines the start of the time-frame in which the
	// resource is marked as used.
	StartTime time.Time `json:"startTime" bson:"startTime"`

	// EndTime may be used to specify the end of the in-use time
	// frame. If left nil, the use-record must be ended manually.
	EndTime *time.Time `json:"endTime" bson:"endTime,omitempty"`
}

// InUse returns true if the use-record is currently
// active and the resource associated is marked as used.
func (r *UseRecord) InUse(t time.Time) bool {
	if t.Before(r.StartTime) {
		return false
	}
	if r.EndTime != nil && t.After(*r.EndTime) {
		return false
	}
	return true
}
