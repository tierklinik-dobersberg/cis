package rosterdb

import (
	"context"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/event"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
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
	Date        string `json:"date,omitempty" bson:"date,omitempty"`
	DisplayName string `json:"displayName,omitempty" bson:"displayName,omitempty"`
	User        string `json:"user,omitempty" bson:"user,omitempty"`
	Phone       string `json:"phone,omitempty" bson:"phone,omitempty"`
}

func (db *database) fireChangeEvent(ctx context.Context, month time.Month, year int) {
	roster, err := db.ForMonth(ctx, month, year)
	if err != nil {
		logger.From(ctx).WithFields(logger.Fields{
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

func (db *database) fireOverwriteDeleteEvent(ctx context.Context, d time.Time) {
	event.Fire(ctx, "event/roster/overwrite/delete", OverwriteEvent{
		Reset: true,
		Date:  d.Format("2006-01-02"),
	})
}

func (db *database) fireOverwriteEvent(ctx context.Context, d time.Time, user, phone, name string) {
	event.Fire(ctx, "event/roster/overwrite/create", OverwriteEvent{
		DisplayName: name,
		User:        user,
		Phone:       phone,
		Reset:       false,
		Date:        d.Format("2006-01-02"),
	})
}
