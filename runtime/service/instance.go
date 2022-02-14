package service

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	"github.com/tierklinik-dobersberg/logger"
)

type contextKey string

const instanceContextKey = contextKey("service:instance")

type Instance struct {
	Config
	svcenv.ServiceEnv

	cfgFile    *conf.File
	logAdapter *logAdapter
}

// ConfigFile returns the parsed conf.File content
// of the service configuration file.
func (inst *Instance) ConfigFile() *conf.File {
	return inst.cfgFile
}

// AddLogger adds adapter to the list of logging adapters
// used by inst. Note that messages with lower severity
// than the threshold set by SetLogLevel will be discarded
// and not passed to adapter.
func (inst *Instance) AddLogger(adapter logger.Adapter) {
	inst.logAdapter.addAdapter(adapter)
}

// SetLogLevel configures the maximum log level for the
// instance logger.
func (inst *Instance) SetLogLevel(s logger.Severity) {
	inst.logAdapter.setMaxSeverity(s)
}
