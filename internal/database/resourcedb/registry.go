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

// Create creates a new resource r at reg. If r is dynamic
// a Resource-Created event will be fired.
func (reg *Registry) Create(r Resource) error {
	if err := ValidateResource(r); err != nil {
		return err
	}

	reg.rw.Lock()
	defer reg.rw.Unlock()
	if _, ok := reg.resources[r.ID]; ok {
		return ErrDuplicateID
	}
	reg.resources[r.ID] = r

	return nil
}

// Get returns the resource with ID set to id.
func (reg *Registry) Get(id string) (Resource, error) {
	if id == "" {
		return Resource{}, ErrEmptyID
	}

	reg.rw.RLock()
	defer reg.rw.RUnlock()
	r, ok := reg.resources[id]
	if !ok {
		return Resource{}, ErrUnknownID
	}
	return r, nil
}

// List returns a list of all resources.
func (reg *Registry) List() []Resource {
	reg.rw.RLock()
	defer reg.rw.RUnlock()
	res := make([]Resource, 0, len(reg.resources))
	for _, r := range reg.resources {
		res = append(res, r)
	}
	return res
}

// Has returns true if registry knows about a given resource.
func (reg *Registry) Has(id string) bool {
	reg.rw.RLock()
	defer reg.rw.RUnlock()

	_, ok := reg.resources[id]
	return ok
}
