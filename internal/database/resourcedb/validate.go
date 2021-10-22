package resourcedb

import "errors"

var (
	ErrEmptyID                 = errors.New("resource ID is empty")
	ErrEmptyName               = errors.New("resource Name is empty")
	ErrInvalidMaxConcurrentUse = errors.New("invalid MaxConcurrentUse")
	ErrDuplicateID             = errors.New("duplicate resource ID")
	ErrUnknownID               = errors.New("unknown resource ID")
	ErrStaticResource          = errors.New("resource is static")
	ErrInvalidEndTime          = errors.New("invalid end time")
	ErrEmptyOrigin             = errors.New("empty origin")
)

// ValidateResource validates r and returns any error encountered.
func ValidateResource(r Resource) error {
	if r.ID == "" {
		return ErrEmptyID
	}
	if r.Name == "" {
		return ErrEmptyName
	}
	if r.MaxConcurrentUse < 0 {
		return ErrInvalidMaxConcurrentUse
	}
	return nil
}
