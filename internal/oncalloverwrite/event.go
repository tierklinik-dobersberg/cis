package oncalloverwrite

import (
	"context"
	"time"

	"github.com/tierklinik-dobersberg/cis/runtime/event"
)

var (
	eventCreate = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/roster/overwrite/create",
	})
	eventDelete = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/roster/overwrite/delete",
	})
)

type OverwriteEvent struct {
	Reset       bool   `json:"reset,omitempty" bson:"reset,omitempty"`
	From        string `json:"from,omitempty" bson:"from,omitempty"`
	To          string `json:"to,omitempty" bson:"to,omitempty"`
	DisplayName string `json:"displayName,omitempty" bson:"displayName,omitempty"`
	User        string `json:"user,omitempty" bson:"user,omitempty"`
	Phone       string `json:"phone,omitempty" bson:"phone,omitempty"`
}

func (db *database) fireOverwriteDeleteEvent(ctx context.Context, from, to time.Time) {
	eventDelete.Fire(ctx, OverwriteEvent{
		Reset: true,
		From:  from.Format(time.RFC3339),
		To:    to.Format(time.RFC3339),
	})
}

func (db *database) fireOverwriteEvent(ctx context.Context, from, to time.Time, user, phone, name string) {
	eventCreate.Fire(ctx, OverwriteEvent{
		DisplayName: name,
		User:        user,
		Phone:       phone,
		Reset:       false,
		From:        from.Format(time.RFC3339),
		To:          to.Format(time.RFC3339),
	})
}
