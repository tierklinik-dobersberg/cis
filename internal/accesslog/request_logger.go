package accesslog

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
)

// New returns a gin handler function that logs all incoming
// requests to log.‚
func New(log logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery
		if raw != "" {
			path = path + "?" + raw
		}

		c.Next()

		end := time.Now()
		latency := end.Sub(start)
		if newConfig.UTC {
			end = end.UTC()
		}

		msg := "Request"
		if len(c.Errors) > 0 {
			msg = c.Errors.String()
		}

		fields := logger.Fields{
			"status":     c.Writer.Status(),
			"method":     c.Request.Method,
			"path":       path,
			"ip":         c.ClientIP(),
			"latency":    latency,
			"user-agent": c.Request.UserAgent(),
		}

		log.WithFields(fields).Info(msg)
	}
}
