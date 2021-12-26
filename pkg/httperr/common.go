// nolint:goerr13

package httperr

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrBadRequest is used when there's no detailed error to report.
var ErrBadRequest = errors.New("bad request")

// ErrNotFound is a generic not found error.
var ErrNotFound = errors.New("not found")

// NotFound returns a new not found error. If err is nil
// than ErrNotFound will be used.
func NotFound(resourceType, resourceName string, err error) *Error {
	if err == nil {
		err = ErrNotFound
	}
	return New(http.StatusNotFound, err, gin.H{
		"error": fmt.Sprintf("%s resource %s not found", resourceType, resourceName),
	})
}

// InternalError returns a new internal server error.
func InternalError(err error, msg ...string) *Error {
	var errorMsg interface{}
	if len(msg) > 0 {
		errorMsg = gin.H{
			"error": msg[0],
		}

		if err == nil {
			err = errors.New(msg[0])
		}
	}

	return New(http.StatusInternalServerError, err, errorMsg)
}

// BadRequest returns a new bad requets error. If err is nil
// ErrBadRequest is used instead.
func BadRequest(err error, msg ...string) *Error {
	var errorMsg interface{}
	if len(msg) > 0 {
		errorMsg = gin.H{
			"error": msg[0],
		}
		if err == nil {
			err = errors.New(msg[0])
		}
	}

	if err == nil {
		err = ErrBadRequest
	}

	return New(http.StatusBadRequest, err, errorMsg)
}

// MissingParameter is a helper method for returning
// 400 Bad Request for a missing parameter.
func MissingParameter(name string) *Error {
	return BadRequest(
		fmt.Errorf("missing parameter %q", name),
	)
}

// MissingField is a helper method for returning
// 400 Bad Request for a missing body field.
func MissingField(name string) *Error {
	return BadRequest(
		fmt.Errorf("missing field %q in body", name),
	)
}

// InvalidParameter is a helper method for returning
// 400 Bad Request for an invalid parameter value.
func InvalidParameter(name string, value ...string) *Error {
	err := fmt.Errorf("invalid value for parameter %q", name)
	if len(value) > 0 {
		err = fmt.Errorf("%w: %s", err, value)
	}
	return BadRequest(err)
}

// InvalidField is a helper method for returning
// 400 Bad Request for an invalid body payload field value.
func InvalidField(name string) *Error {
	return BadRequest(
		fmt.Errorf("invalid value for field %q in body", name),
	)
}

// Forbidden returns 403 Forbidden.
func Forbidden(err error, msg ...string) *Error {
	var errorMsg interface{}
	if len(msg) > 0 {
		errorMsg = gin.H{
			"error": msg[0],
		}
		if err == nil {
			err = errors.New(msg[0])
		}
	}
	return New(http.StatusForbidden, err, errorMsg)
}

func PreconditionFailed(msg string) *Error {
	return New(http.StatusPreconditionFailed, errors.New(msg), nil)
}

func UnsupportedMediaType(msg string) *Error {
	return New(http.StatusUnsupportedMediaType, errors.New(msg), nil)
}

func RequestToLarge(msg string, args ...interface{}) *Error {
	return New(http.StatusRequestEntityTooLarge, fmt.Errorf(msg, args...), nil)
}

func Conflict(msg string, args ...interface{}) *Error {
	return New(http.StatusConflict, fmt.Errorf(msg, args...), nil)
}
