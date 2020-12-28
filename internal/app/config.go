package app

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/service/server"
)

type Config struct {
	schema.IdentityConfig `section:"Global"`
	schema.Config         `section:"Global"`
	schema.DatabaseConfig `section:"Global"`
	schema.VetInf         `section:"Import"`

	HolidayOpeningHour schema.OpeningHours   `section:"HolidayOpeningHour"`
	OpeningHours       []schema.OpeningHours `section:"OpeningHour"`
	UserProperties     []conf.OptionSpec     `section:"UserProperty"`
	Listeners          []server.Listener     `section:"Listener"`
}
