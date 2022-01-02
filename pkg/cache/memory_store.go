package cache

import (
	"context"
	"strings"
	"sync"
)

type memory struct {
	l       sync.RWMutex
	records map[string]Record
}

// NewMemoryStore returns a new cache.Store that keeps all records
// in memory. Only use for really ephemeral data!
func NewMemoryStore() Store {
	return &memory{
		records: make(map[string]Record),
	}
}

func (mem *memory) Lock(ctx context.Context) (UnlockFunc, bool) {
	mem.l.Lock()
	return func() {
		mem.l.Unlock()
	}, true
}

func (mem *memory) Put(_ context.Context, r KeyRecord) error {
	mem.records[r.Key] = cloneRecord(r.Record)
	return nil
}

func (mem *memory) Get(_ context.Context, key string) (*KeyRecord, error) {
	r, ok := mem.records[key]
	if !ok {
		return nil, ErrNotFound
	}

	c := cloneRecord(&r)
	return &KeyRecord{
		Key:    key,
		Record: &c,
	}, nil
}

func (mem *memory) Delete(_ context.Context, key string) error {
	if _, ok := mem.records[key]; !ok {
		return ErrNotFound
	}
	delete(mem.records, key)
	return nil
}

func (mem *memory) List(_ context.Context, prefix string) ([]*KeyRecord, error) {
	var res []*KeyRecord
	for key := range mem.records {
		r := mem.records[key]

		if strings.HasPrefix(key, prefix) {
			c := cloneRecord(&r)
			res = append(res, &KeyRecord{
				Key:    key,
				Record: &c,
			})
		}
	}
	return res, nil
}

// Compile time check.
var _ Store = new(memory)
