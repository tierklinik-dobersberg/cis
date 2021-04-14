package v1alpha

import (
	"github.com/tierklinik-dobersberg/cis/internal/calendar"
)

type Event struct {
	calendar.Event
	Username string `json:"username"`
}
