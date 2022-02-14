package service

import (
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

type logAdapter struct {
	maxSeverity logger.Severity
	rw          sync.RWMutex
	adapters    []logger.Adapter
}

// Write implements logger.Adapter
func (l *logAdapter) Write(clock time.Time, severity logger.Severity, msg string, fields logger.Fields) {
	l.rw.RLock()
	defer l.rw.RUnlock()

	if severity > l.maxSeverity {
		return
	}

	for _, adapter := range l.adapters {
		adapter.Write(clock, severity, msg, fields)
	}
}

func (l *logAdapter) addAdapter(a logger.Adapter) {
	l.rw.Lock()
	defer l.rw.Unlock()
	l.adapters = append(l.adapters, a)
}

func (l *logAdapter) setMaxSeverity(s logger.Severity) {
	l.rw.Lock()
	defer l.rw.Unlock()
	l.maxSeverity = s
}
