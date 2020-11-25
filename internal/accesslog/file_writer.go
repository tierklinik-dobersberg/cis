package accesslog

import (
	"encoding/json"
	"os"
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

type FileWriter struct {
	Path         string
	ErrorAdapter logger.Adapter
}

// Write is called for each log message and implements logger.Adapter.
func (fl *FileWriter) Write(clock time.Time, severtiy logger.Severity, msg string, fields logger.Fields) {
	f, err := os.OpenFile(fl.Path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		// Create a new StdlibAdapter and write a warning message there
		// so there's at least a chance of a user noticing the file-log
		// doesn't work.
		fl.ErrorAdapter.Write(time.Now(), logger.Error, "failed to create log file", logger.Fields{
			"error": err.Error(),
			"path":  fl.Path,
		})
		return
	}
	defer f.Close()

	obj := map[string]interface{}{
		"time":     clock,
		"severity": severtiy,
		"msg":      msg,
		"fields":   fields,
	}

	blob, err := json.Marshal(obj)
	if err != nil {
		obj["fields"] = err.Error()
		blob, _ = json.Marshal(obj)
	}
	blob = append(blob, '\n')

	n, err := f.Write(blob)
	if err != nil || n != len(blob) {
		errMsg := "<nil>"
		if err != nil {
			errMsg = err.Error()
		}
		fl.ErrorAdapter.Write(time.Now(), logger.Error, "incomplete write to log file", logger.Fields{
			"error":        errMsg,
			"expectedSize": len(blob),
			"bytesWritten": n,
			"path":         fl.Path,
		})
	}
}
