package roster

import (
	"context"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
)

var (
	eventCreate = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/roster/overwrite/create",
	})
	eventUpdate = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/roster/overwrite/update",
	})
	eventDelete = event.MustRegisterType(event.Type{
		ID: "vet.dobersberg.cis/roster/overwrite/delete",
	})
)

type RosterUpdateEvent struct {
	v1alpha.DutyRoster
}

type RosterDeleteEvent struct {
	Year  int        `json:"year,omitempty" bson:"year,omitempty"`
	Month time.Month `json:"month,omitempty" bson:"month,omitempty"`
}

type OverwriteEvent struct {
	Reset       bool   `json:"reset,omitempty" bson:"reset,omitempty"`
	From        string `json:"from,omitempty" bson:"from,omitempty"`
	To          string `json:"to,omitempty" bson:"to,omitempty"`
	DisplayName string `json:"displayName,omitempty" bson:"displayName,omitempty"`
	User        string `json:"user,omitempty" bson:"user,omitempty"`
	Phone       string `json:"phone,omitempty" bson:"phone,omitempty"`
}

func (db *database) fireChangeEvent(ctx context.Context, month time.Month, year int) {
	roster, err := db.ForMonth(ctx, month, year)
	if err != nil {
		log.From(ctx).WithFields(logger.Fields{
			"year":  year,
			"month": month,
		}).Errorf("failed to fire event: %s", err)
		return
	}

	eventCreate.Fire(ctx, RosterUpdateEvent{
		DutyRoster: *roster,
	})
}

func (db *database) fireDeleteEvent(ctx context.Context, month time.Month, year int) {
	eventDelete.Fire(ctx, RosterDeleteEvent{
		Year:  year,
		Month: month,
	})
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
