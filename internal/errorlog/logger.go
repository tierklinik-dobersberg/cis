package errorlog

import (
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

// Adapter implements logger.Adapter and supports sending
// error messages to a different log adapter as well.
type Adapter struct {
	defaultAdapter logger.Adapter

	rw           sync.RWMutex
	errorAdapter logger.Adapter
}

// New returns a new adapter.
func New(defaultAdapter logger.Adapter) *Adapter {
	return &Adapter{
		defaultAdapter: defaultAdapter,
	}
}

func (a *Adapter) Write(clock time.Time, severity logger.Severity, msg string, fields logger.Fields) {
	a.rw.Lock()
	defer a.rw.Unlock()
	a.defaultAdapter.Write(clock, severity, msg, fields)
	if severity == logger.Error {

		if a.errorAdapter != nil {
			a.errorAdapter.Write(clock, severity, msg, fields)
		}
	}
}

func (a *Adapter) AddDefaultAdapter(adapter logger.Adapter) {
	a.rw.Lock()
	defer a.rw.Unlock()

	if a.defaultAdapter == nil {
		a.defaultAdapter = adapter
	} else {
		a.defaultAdapter = logger.MultiAdapter(a.defaultAdapter, adapter)
	}
}

// AddErrorAdapter sets the log adapter that should receive error messages.
func (a *Adapter) AddErrorAdapter(errAdapter logger.Adapter) {
	a.rw.Lock()
	defer a.rw.Unlock()

	if a.errorAdapter == nil {
		a.errorAdapter = errAdapter
	} else {
		// if there's already an error adapter we wrap it into
		// a multi-adapter.
		a.errorAdapter = logger.MultiAdapter(a.errorAdapter, errAdapter)
	}
}
