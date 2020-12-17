package app

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/service/server"
)

type Config struct {
	schema.IdentityConfig `section:"Identity,required"`
	schema.Config         `section:"Global,required"`

	UserProperties []conf.OptionSpec `section:"UserProperty"`
	Listeners      []server.Listener `section:"Listener"`
}
