package event

import "time"

type EventData interface{}

type Event struct {
	ID      string    `json:"id"`
	Data    EventData `json:"data"`
	Created time.Time `json:"createdAt"`
}
