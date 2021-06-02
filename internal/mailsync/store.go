package mailsync

import "context"

// Store stores the state of individual mail syncers.
type Store interface {
	// LoadState should return the state stored under name. If no state
	// is stored LoadState should return a nil state and a nil error.
	// In case of an error LoadState should return a non-nil error.
	LoadState(ctx context.Context, name string) (*State, error)

	// SaveState should store state and make it retrievable by it's name.
	// It should return a non-nil error if the state cannot be stored
	// for whatever reason.
	SaveState(ctx context.Context, state State) error
}

// LoadStateFunc is the function definition of LoadState in the Store interface.
type LoadStateFunc func(ctx context.Context, name string) (*State, error)

// SaveStateFunc is the function definition of SaveState in the Store interface.
type SaveStateFunc func(ctx context.Context, state State) error

// SimpleStore is a convenience struct for implementing Store with anonymous
// functions.
type SimpleStore struct {
	Load LoadStateFunc
	Save SaveStateFunc
}

// LoadState implements Store.LoadState.
func (s *SimpleStore) LoadState(ctx context.Context, name string) (*State, error) {
	return s.Load(ctx, name)
}

// SaveState implements Store.SaveState.
func (s *SimpleStore) SaveState(ctx context.Context, state State) error {
	return s.Save(ctx, state)
}
