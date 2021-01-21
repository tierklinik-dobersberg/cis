package httperr

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrBadRequest is used when there's no detailed error to report.
var ErrBadRequest = errors.New("bad request")

// NotFound returns a new not found error.
func NotFound(resourceType, resourceName string, err error) *Error {
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
	}

	if err == nil {
		err = ErrBadRequest
	}

	return New(http.StatusBadRequest, err, errorMsg)
}
