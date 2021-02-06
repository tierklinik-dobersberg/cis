package mailsync

import "go.mongodb.org/mongo-driver/mongo"

// CollectionName is the name of the mail-sync mongodb
// collection.
const CollectionName = "mail-sync-state"

// State is the state of a mail syncer.
type State struct {
	// ID is the MongoDB object ID.
	ID string `bson:"_id,omitempty"`
	// Name is the name of the mail syncer the
	// state belongs to.
	Name string `bson:"name,omitempty"`
	// ConfigHash is a hash of the mailbox account
	// configuration required to detected changes.
	ConfigHash string `bson:"configHash,omitempty"`
	// UIDValidtity is the last UIDVALIDITY value
	// seen.
	UIDValidity int `bson:"uidValidity,omitempty"`
	// LastUIDFetched is the last mail UID that has
	// been fetched.
	// Only valid if UIDValidity is still unchanged.
	LastUIDFetched int `bson:"lastUidFetched,omitempty"`
}

// Syncer syncs mails with mongodb.
type Syncer struct {
	state      State
	collection *mongo.Collection
}
