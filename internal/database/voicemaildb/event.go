package voicemaildb

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	eventVoicemailUnread = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/voicemail/unread",
	})
	eventVoicemailRead = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/voicemail/read",
	})
)

// VoiceMailEvent is fired when a voicemail message is read or unread.
type VoicemailEvent struct {
	VoiceMail      string             `json:"voiceMail,omitempty" bson:"voiceMail,omitempty"`
	From           string             `json:"from,omitempty" bson:"from,omitempty"`
	CustomerID     string             `json:"customerID,omitempty" bson:"customerID,omitempty"`
	CustomerSource string             `json:"customerSource,omitempty" bson:"customerSource,omitempty"`
	Read           bool               `json:"read,omitempty" bson:"read,omitempty"`
	ID             primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	CountUnread    int                `json:"countUnread" bson:"countUnread"`
}

func (db *database) fireEvent(ctx context.Context, id string, created bool) {
	record, err := db.ByID(ctx, id)
	if err != nil {
		logger.From(ctx).Errorf("failed to fire event for record id: %s: %s", id, err)
		return
	}

	// count number of unread documents in the same mailbox
	all, err := db.Search(ctx, new(SearchOptions).ByVoiceMail(record.Name).BySeen(false))
	if err != nil {
		logger.From(ctx).Errorf("failed to count unread voicemails for %s: %s", record.Name, err)
	}

	payload := VoicemailEvent{
		VoiceMail:      record.Name,
		From:           record.From,
		CustomerID:     record.CustomerID,
		CustomerSource: record.CustomerSource,
		Read:           record.Read,
		ID:             record.ID,
		CountUnread:    len(all),
	}

	if created {
		eventVoicemailUnread.Fire(ctx, payload)
	} else if record.Read {
		eventVoicemailRead.Fire(ctx, payload)
	}
}
