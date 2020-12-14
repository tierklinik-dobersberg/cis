package app

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

type Config struct {
	schema.GlobalConfig `section:"Global,required"`
	UserProperties      []conf.OptionSpec `section:"UserProperty"`
	Listeners           []server.Listener `section:"Listener"`
}
