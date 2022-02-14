package execer

import (
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
)

var log = pkglog.New("execer")

func init() {
	runtime.Must(AddTriggerType("Exec", trigger.DefaultRegistry))
}
