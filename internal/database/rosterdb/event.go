package rosterdb

import (
	"context"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
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

	event.Fire(ctx, fmt.Sprintf("event/roster/update/%04d/%02d", year, month), RosterUpdateEvent{
		DutyRoster: *roster,
	})
}

func (db *database) fireDeleteEvent(ctx context.Context, month time.Month, year int) {
	event.Fire(ctx, fmt.Sprintf("event/roster/delete/%04d/%02d", year, month), RosterDeleteEvent{
		Year:  year,
		Month: month,
	})
}

func (db *database) fireOverwriteDeleteEvent(ctx context.Context, from, to time.Time) {
	event.Fire(ctx, "event/roster/overwrite/delete", OverwriteEvent{
		Reset: true,
		From:  from.Format(time.RFC3339),
		To:    to.Format(time.RFC3339),
	})
}

func (db *database) fireOverwriteEvent(ctx context.Context, from, to time.Time, user, phone, name string) {
	event.Fire(ctx, "event/roster/overwrite/create", OverwriteEvent{
		DisplayName: name,
		User:        user,
		Phone:       phone,
		Reset:       false,
		From:        from.Format(time.RFC3339),
		To:          to.Format(time.RFC3339),
	})
}
