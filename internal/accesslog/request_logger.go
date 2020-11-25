package accesslog

import (
	"strings"
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

		msg := "Request"
		if len(c.Errors) > 0 {
			msg = c.Errors.String()
		}

		fields := logger.Fields{
			"http:status":      c.Writer.Status(),
			"http:method":      c.Request.Method,
			"http:path":        path,
			"http:ip":          c.ClientIP(),
			"http:latency":     latency.String(),
			"http:latency-raw": latency,
			"http:user-agent":  c.Request.UserAgent(),
		}

		// merge existing fields in the request context
		existingFields := logger.ContextFields(c.Request.Context())
		for k, v := range existingFields {
			fields[k] = v
		}

		// merge fields from the gin.Context
		for k, v := range c.Keys {
			// gin keys prefixed with underscore are marked
			// as private.
			if !strings.HasPrefix(k, "_") {
				fields[k] = v
			}
		}

		log.WithFields(fields).Info(msg)
	}
}
