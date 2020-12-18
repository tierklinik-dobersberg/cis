package customerdb

import "errors"

var (
	// ErrNotFound is returned when the requested document daoes not exist.
	ErrNotFound = errors.New("document not found")
)
