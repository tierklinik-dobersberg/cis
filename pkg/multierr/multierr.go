package multierr

import (
	"errors"
	"fmt"
)

type Error struct {
	Errors []error
}

func (err *Error) Add(another error) *Error {
	if another != nil {
		err.Errors = append(err.Errors, another)
	}
	return err
}

func (err *Error) Addf(msg string, args ...interface{}) *Error {
	return err.Add(fmt.Errorf(msg, args...))
}

func (err *Error) ToError() error {
	if len(err.Errors) == 0 {
		return nil
	}
	return err
}

func (err *Error) Error() string {
	msg := "multiple errors encountered: "
	for _, e := range err.Errors {
		msg += "\n * " + e.Error()
	}
	return msg
}

// Is checks all errors in err against what using errors.Is.
func (err *Error) Is(what error) bool {
	for _, e := range err.Errors {
		if errors.Is(e, what) {
			return true
		}
	}
	return false
}

func (err *Error) As(what interface{}) bool {
	for _, e := range err.Errors {
		if errors.As(e, what) {
			return true
		}
	}
	return false
}
