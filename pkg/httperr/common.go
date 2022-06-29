// nolint:goerr13

package httperr

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

// NotFound returns a new not found error. If err is nil
// than ErrNotFound will be used.
func NotFound(resourceType, resourceName string) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("%s resource %s not found", resourceType, resourceName))
}

// InternalError returns a new internal server error.
func InternalError(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusInternalServerError, msg...)
}

// BadRequest returns a new bad requets error.
func BadRequest(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusBadRequest, msg...)
}

// MissingParameter is a helper method for returning
// 400 Bad Request for a missing parameter.
func MissingParameter(name string) *echo.HTTPError {
	return BadRequest(
		fmt.Sprintf("missing parameter %q", name),
	)
}

// MissingField is a helper method for returning
// 400 Bad Request for a missing body field.
func MissingField(name string) *echo.HTTPError {
	return BadRequest(
		fmt.Sprintf("missing field %q in body", name),
	)
}

// InvalidParameter is a helper method for returning
// 400 Bad Request for an invalid parameter value.
func InvalidParameter(name string, value ...string) *echo.HTTPError {
	err := fmt.Sprintf("invalid value for parameter %q", name)
	if len(value) > 0 {
		err = fmt.Sprintf("%s: %s", err, value)
	}
	return BadRequest(err)
}

// InvalidField is a helper method for returning
// 400 Bad Request for an invalid body payload field value.
func InvalidField(name string) *echo.HTTPError {
	return BadRequest(
		fmt.Sprintf("invalid value for field %q in body", name),
	)
}

// Forbidden returns 403 Forbidden.
func Forbidden(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusForbidden, msg...)
}

func Unauthorized(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusUnauthorized, msg...)
}

func PreconditionFailed(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusPreconditionFailed, msg...)
}

func UnsupportedMediaType(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusUnsupportedMediaType, msg...)
}

func RequestToLarge(msg ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusRequestEntityTooLarge, msg...)
}

func Conflict(args ...interface{}) *echo.HTTPError {
	return echo.NewHTTPError(http.StatusConflict, args...)
}
