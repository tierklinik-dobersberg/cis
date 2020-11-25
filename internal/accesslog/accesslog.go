package accesslog

import (
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

type FileWriter struct {
	Path string
}

// Write is called for each log message and implements logger.Adapter.
func (fl *FileWriter) Write(clock time.Time, severtiy logger.Severity, msg string, fields logger.Fields) {

}
