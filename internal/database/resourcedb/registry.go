package resourcedb

import "sync"

type Registry struct {
	rw        sync.RWMutex
	resources map[string]Resource
}

// NewRegistry creates a new resource registry.
func NewRegistry() *Registry {
	return &Registry{
		resources: make(map[string]Resource),
	}
}
