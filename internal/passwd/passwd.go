package passwd

import (
	"context"
	"errors"
	"strings"
	"sync"
)

var (
	// ErrUnknownAlgo indicates that the algorithm used for the
	// hash is not supported.
	ErrUnknownAlgo = errors.New("unknown algorithm")
)

// CompareFunc returns true uf the plaintext matches the hash.
type CompareFunc func(ctx context.Context, username, hash, plaintext string) (bool, error)

var (
	lock          sync.RWMutex
	supportedAlgo map[string]CompareFunc
)

// Register registeres a new compare function for algo.
func Register(algo string, fn CompareFunc) {
	lock.Lock()
	defer lock.Unlock()

	if supportedAlgo == nil {
		supportedAlgo = make(map[string]CompareFunc)
	}

	if _, ok := supportedAlgo[strings.ToLower(algo)]; ok {
		panic("hash algorithm " + algo + " already registered")
	}

	supportedAlgo[strings.ToLower(algo)] = fn
}

// Compare checks if plaintext matches hash using algo.
func Compare(ctx context.Context, algo, username, hash string, plaintext string) (bool, error) {
	lock.RLock()
	defer lock.RUnlock()

	fn, ok := supportedAlgo[strings.ToLower(algo)]
	if !ok {
		return false, ErrUnknownAlgo
	}

	return fn(ctx, username, hash, plaintext)
}
