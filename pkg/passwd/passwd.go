package passwd

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
)

var (
	// ErrUnknownAlgo indicates that the algorithm used for the
	// hash is not supported.
	ErrUnknownAlgo = errors.New("unknown algorithm")
)

type (
	// CompareFunc returns true uf the plaintext matches the hash.
	CompareFunc func(ctx context.Context, hash, plaintext string) (bool, error)

	// HashFunc should create a hashed version of plaintext.
	HashFunc func(ctx context.Context, plaintext string) (string, error)

	knownAlog struct {
		CompareFunc
		HashFunc
	}
)

var (
	lock          sync.RWMutex
	supportedAlgo map[string]*knownAlog
)

// Register registers a new compare function for algo.
func Register(algo string, cmpFn CompareFunc, hashFn HashFunc) {
	lock.Lock()
	defer lock.Unlock()

	if supportedAlgo == nil {
		supportedAlgo = make(map[string]*knownAlog)
	}

	if _, ok := supportedAlgo[strings.ToLower(algo)]; ok {
		panic("hash algorithm " + algo + " already registered")
	}

	supportedAlgo[strings.ToLower(algo)] = &knownAlog{
		CompareFunc: cmpFn,
		HashFunc:    hashFn,
	}
}

// Compare checks if plaintext matches hash using algo.
func Compare(ctx context.Context, algo, hash string, plaintext string) (bool, error) {
	lock.RLock()
	defer lock.RUnlock()

	entry, ok := supportedAlgo[strings.ToLower(algo)]
	if !ok {
		return false, fmt.Errorf("%s: %w", algo, ErrUnknownAlgo)
	}

	return entry.CompareFunc(ctx, hash, plaintext)
}

// Hash creates a hashed representation of plaintext using algo.
func Hash(ctx context.Context, algo, plaintext string) (string, error) {
	lock.RLock()
	defer lock.RUnlock()

	if algo == "" {
		algo = "bcrypt"
	}

	entry, ok := supportedAlgo[strings.ToLower(algo)]
	if !ok {
		return "", fmt.Errorf("%s: %w", algo, ErrUnknownAlgo)
	}
	return entry.HashFunc(ctx, plaintext)
}
