package calendar

import (
	"time"

	"github.com/ppacher/system-conf/conf"
)

type Calendar struct {
	ID       string         `json:"_id" bson:"_id,omitempty"`
	Name     string         `json:"name" bson:"name,omitempty"`
	Timezone string         `json:"timeZone,omitempty" bson:"timeZone,omitempty"`
	Location *time.Location `json:"-" bson:"-"`
}

type Event struct {
	ID           string           `json:"_id" bson:"_id"`
	Summary      string           `json:"summary" bson:"summary,omitempty"`
	Description  string           `json:"description,omitempty" bson:"description,omitempty"`
	StartTime    time.Time        `json:"startTime" bson:"startTime,omitempty"`
	EndTime      *time.Time       `json:"endTime,omitempty" bson:"endTime,omitempty"`
	CalendarID   string           `json:"calendarID" bson:"calendarID,omitempty"`
	FullDayEvent bool             `json:"fullDayEvent" bson:"fullDayEvent"`
	Data         *StructuredEvent `json:"data,omitempty" bson:"data,omitempty"`
}

type StructuredEvent struct {
	CustomerSource string `json:"customerSource" bson:"customerSource,omitempty"`
	CustomerID     int    `json:"customerID" bson:"customerID,omitempty"`
	AnimalID       string `json:"animalID" bson:"animalID,omitempty"`
	CreatedBy      string `json:"createdBy" bson:"createdBy,omitempty"`
	CreatedAt      string `json:"createdAt" bson:"createdAt,omitempty"`
}

var StructuredEventSpec = conf.SectionSpec{
	{
		Name:        "CustomerSource",
		Description: "The source of the customer",
		Type:        conf.StringType,
	},
	{
		Name:        "CustomerID",
		Description: "The customer ID",
		Type:        conf.IntType,
	},
	{
		Name:        "AnimalID",
		Description: "ID of the customers animal",
		Type:        conf.StringType,
	},
	{
		Name:        "CreatedBy",
		Description: "Username of the user that created the event",
		Type:        conf.StringType,
	},
	{
		Name:        "CreatedAt",
		Description: "Datetime in RFC3339 at which the event has been created",
		Type:        conf.StringType,
	},
}

type EventSearchOptions struct {
	from *time.Time
	to   *time.Time
}

func (s *EventSearchOptions) From(t time.Time) *EventSearchOptions {
	s.from = &t
	return s
}

func (s *EventSearchOptions) To(t time.Time) *EventSearchOptions {
	s.to = &t
	return s
}

func (s *EventSearchOptions) ForDay(t time.Time) *EventSearchOptions {
	s.From(time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()))
	s.To(time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, t.Location()))
	return s
}
