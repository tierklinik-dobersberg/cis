package customerdb

import (
	"context"
	"errors"
	"strings"
	"sync"
)

// Common errors when working with customer sources.
var (
	ErrSourceRegistered   = errors.New("source already registered")
	ErrEmptySourceName    = errors.New("source name is empty")
	ErrDeleteNotSupported = errors.New("source does not support deletes")
	ErrUnknownSource      = errors.New("unknown source")
)

// Source describes a source of customer records. They are typically registered
// by importers and allow to further interact with the third-party store (where
// supported).
type Source struct {
	// Name is the name of the customer source and should be set as the "Source"
	// field on each customer record created by this source.
	Name string

	// Description is a human readable description of the source.
	Description string

	// Metadata holds customer source metadata that is serialized
	// as JSON via the customerapi. Values must not change after
	// the source has been registered.
	Metadata map[string]interface{}

	// DeleteFunc should delete the customer from source. Upon successful
	// deletion the customer is also deleted from the internal database.
	DeleteFunc func(ctx context.Context, cus *Customer) error

	// UpdateFunc should update the representation of cus in the source.
	UpdateFunc func(ctx context.Context, cus *Customer) error

	// CreateFunc should create a new customer in source that mirrors the
	// data stored in cus. cus is a new customer object that is not yet
	// associated with any other customer source. CreateFunc should update
	// the customer metadata as it needs. Upon successful return
	// cus is actually created by the database inside the local collection.
	// Note that cus does not yet have an ID property specified.
	CreateFunc func(ctx context.Context, cus *Customer) error
}

// SourceManager manages registered customer sources.
type SourceManager struct {
	l       sync.RWMutex
	sources map[string]*Source
}

// NewSourceManager returns a new source manager.
func NewSourceManager() *SourceManager {
	return &SourceManager{
		sources: make(map[string]*Source),
	}
}

// Register registers the customer source s at mng. It
// is an error if the source name is empty of if a source
// with the same name is already registered.
func (mng *SourceManager) Register(s Source) error {
	mng.l.Lock()
	defer mng.l.Unlock()

	ln := strings.ToLower(s.Name)
	if ln == "" {
		return ErrEmptySourceName
	}
	if _, ok := mng.sources[ln]; ok {
		return ErrSourceRegistered
	}

	mng.sources[ln] = &s

	return nil
}

// ListSources returns a list of customer sources.
func (mng *SourceManager) ListSources() []Source {
	var res []Source
	mng.l.RLock()
	defer mng.l.RUnlock()
	for _, s := range mng.sources {
		res = append(res, *s)
	}
	return res
}

// Delete tries to delete the customer from it's origin source. If no
// customer source is specified, the source does not exist or does not
// support deletes (i.e. DeleteFunc is unset) an error is returned.
// Otherwise, the result of source.DeleteFunc is returned.
func (mng *SourceManager) Delete(ctx context.Context, cus *Customer) error {
	if cus.Source == "" {
		return ErrEmptySourceName
	}

	mng.l.RLock()
	defer mng.l.RUnlock()

	s, ok := mng.sources[strings.ToLower(cus.Source)]
	if !ok {
		return ErrUnknownSource
	}
	if s.DeleteFunc == nil {
		return ErrDeleteNotSupported
	}
	return s.DeleteFunc(ctx, cus)
}

// DefaultSourceManager is the default customer source
// manager.
var DefaultSourceManager = NewSourceManager()
