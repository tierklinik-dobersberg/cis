package rosterdb

import "errors"

// Common errors encountered and returned by this package.
var (
	ErrNotFound = errors.New("duty roster not found")
)
