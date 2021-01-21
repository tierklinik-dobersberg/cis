package httperr

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Error represents an HTTP error.
type Error struct {
	// Code is the http status code that should be returned to
	// the user.
	Code int
	// Err is the actual error that happened. If Context is set
	// Err is NOT returned to the user. Sensitive errors should set
	// and additional context field.
	Err error
	// Context holds additional context data that should be returned
	// to the user.
	Context interface{}
}

// Wrap wraps err in an HTTP error.
func Wrap(err error) *Error {
	return &Error{
		Err: err,
	}
}

// WithCode wrapes err in a HTTP error that aborts a request
// with specific code.
func WithCode(code int, err error) *Error {
	return &Error{
		Err:  err,
		Code: code,
	}
}

// New returns a new HTTP error.
func New(code int, err error, context interface{}) *Error {
	return &Error{
		Err:     err,
		Code:    code,
		Context: context,
	}
}

// Unwrap returns the error wrapped by err.
func (err *Error) Unwrap() error {
	return err.Err
}

func (err *Error) Error() string {
	code := err.Code
	if code == 0 {
		code = http.StatusInternalServerError
	}

	return fmt.Sprintf("%03d: %s", code, err.Err.Error())
}

// AbortRequest aborts the HTTP request in c using the
// error code and message defined in err.
// If code is zero http.StatusInternalServerError (500)
// is used.
func (err *Error) AbortRequest(c *gin.Context) {
	code := err.Code
	if code == 0 {
		code = http.StatusInternalServerError
	}

	var payload interface{}
	if err.Context != nil {
		payload = err.Context
	} else {
		payload = gin.H{
			"error": err.Err.Error(),
		}
	}

	c.AbortWithStatusJSON(code, payload)
}

// Abort aborts the request at c with err.
func Abort(c *gin.Context, err error) {
	if aborter, ok := err.(interface{ AbortRequest(*gin.Context) }); ok {
		aborter.AbortRequest(c)
		return
	}

	if statusCoder, ok := err.(interface{ StatusCode() int }); ok {
		c.AbortWithStatus(statusCoder.StatusCode())
		return
	}

	InternalError(err).AbortRequest(c)
}

// Middleware is a gin Middleware that responds to http
// request with the last error set on c.
func Middleware(c *gin.Context) {
	c.Next()

	// nothing to do if the status has already been written.
	if c.Writer.Written() || c.Writer.Status() != 0 {
		return
	}

	// No error recorded and not status/content written,
	// try to do it ourself.
	if len(c.Errors) == 0 {
		c.Status(http.StatusNoContent)
		return
	}

	// we only care about the very last error here.
	// The error handling in gin is a bit weired IMHO.
	lastErr := c.Errors.Last().Err
	Abort(c, lastErr)
}
