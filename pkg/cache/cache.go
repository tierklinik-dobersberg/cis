package cache

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/tierklinik-dobersberg/logger"
)

// Common errors when working with the cache package:
var (
	ErrNotFound         = errors.New("cache record not found")
	ErrNoMounts         = errors.New("no mounts specified")
	ErrLockFailed       = errors.New("failed to lock storage")
	ErrNoMatchingMount  = errors.New("no storage mounted for path")
	ErrInvalidMount     = errors.New("invalid mount")
	ErrOverlappingMount = errors.New("overlapping mount")
)

// Metadata holds additional metadata for a cache entry.
type Metadata struct {
	// NotValidAfter may hold the time at which the cache entry
	// expires and must not be used anymore.
	NotValidAfter *time.Time

	// CreatedAt holds the timestamp the cache entry has been
	// created.
	CreatedAt time.Time

	// BurnAfterReading is set to true if the cache entry should
	// be evicted/expired as soon as a call to Read() happened.
	// Note that List()ing cache keys does not burn a cache item.
	BurnAfterReading bool
}

// IsValid returns true if the cache entry of md is still valid.
// If the cache entry has already reached it's end-of-life false
// is returned.
func (md *Metadata) IsValid() bool {
	if md.NotValidAfter == nil {
		return true
	}
	return md.NotValidAfter.After(time.Now())
}

// Record represents a cache record stored under a certain key.
// Users of Cache should not care about the Record struct as it'
// mainly exported for Store interface implementers.
type Record struct {
	// Metadata holds additional metadata for the cache record
	Metadata

	// Data is the actual payload of the cache record. The cache package
	// does not make any assumptions about the content stored here.
	Data []byte
}

type Cache interface {
	// Write stores data under key. The cache package does not make any assumptions
	// about the data stored in the cache. Callers must make sure to not modify data
	// after calling write as the underlying cache store might keep a reference to
	// the slice (like the in-memory store). Callers should rather create a copy
	// of the data if later modifications of the slice are likely to happen.
	Write(ctx context.Context, key string, data []byte, opts ...Option) error

	// Read returns the data and associated metadata stored under key.
	// If callers want to manipulate the data returned they are advised
	// to create a copy as the underlying cache store (like the in-memory store)
	// might keep a reference to the returned byte slice. It is safe to
	// manipulate the returned Metadata though.
	Read(ctx context.Context, key string) ([]byte, *Metadata, error)

	// Delete deletes any data stored under key. It returns ErrNotFound
	// if the cache entry to be deleted does not exist.
	Delete(ctx context.Context, key string) error

	// List returns a list of keys matching prefix. Note that List does not
	// remove cache entries that used WithBurnAfterReading(). List will hide
	// any cache items that are not valid anymore (i.e. exceeded their end-of-
	// live).
	List(ctx context.Context, prefix string) ([]string, error)
}

// Mount describes a store being "mounted" on a given path. All cache items
// stored as children of that path will be passed to the mounted store.
type Mount struct {
	// Store is the actual store that keeps track of all cache records
	// under Path.
	Store

	// Path describes the base path of the mount. All items prefixed with
	// this path will be stored in Store.
	Path string
}

type cache struct {
	mounts map[string]*Mount
}

// NewCache returns a new cache instance with the given mounts. If no
// mounts are specified an error is returned.
func NewCache(ctx context.Context, mounts ...Mount) (Cache, error) {
	if len(mounts) == 0 {
		return nil, ErrNoMounts
	}
	c := &cache{
		mounts: make(map[string]*Mount),
	}
	for idx := range mounts {
		mount := &mounts[idx]
		path := trimPath(mount.Path)
		if path == "" || len(strings.Split(path, "/")) > 1 {
			return nil, fmt.Errorf("%q: %w", mount.Path, ErrInvalidMount)
		}
		if _, ok := c.mounts[path]; ok {
			return nil, fmt.Errorf("%s: %w", path, ErrOverlappingMount)
		}
		c.mounts[path] = mount
	}

	go c.gcLoop(ctx)

	return c, nil
}

func (c *cache) gcLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Minute):
			gcCtx, cancel := context.WithTimeout(ctx, time.Second*30)
			c.collectGarbage(gcCtx)
			cancel()
		}
	}
}

func (c *cache) collectGarbage(ctx context.Context) {
	for _, mount := range c.mounts {
		c.cleanMount(ctx, mount)
	}
}

func (c *cache) cleanMount(ctx context.Context, s *Mount) {
	log := logger.From(ctx).WithFields(logger.Fields{
		"mount": s.Path,
	})

	unlock, ok := s.Lock(ctx)
	if !ok {
		return
	}
	defer unlock()

	records, err := s.List(ctx, "")
	if err != nil {
		//  TODO(ppacher): we should log this one ...
		log.V(4).Logf("failed to list records: %s", err)
		return
	}

	deleted := 0
	failed := 0
	valid := 0
	for _, record := range records {
		if record.Record.IsValid() {
			valid++
			continue
		}

		if err := s.Delete(ctx, record.Key); err != nil {
			failed++
			log.V(4).Logf("failed to delete key %s: %s", record.Key, err)
			continue
		}
		deleted++
	}

	log.WithFields(logger.Fields{
		"deleted": deleted,
		"failed":  failed,
		"valid":   valid,
	}).V(6).Logf("finished garbage collection")
}

func (c *cache) Write(ctx context.Context, key string, data []byte, opts ...Option) error {
	r := &Record{
		Data: data,
		Metadata: Metadata{
			CreatedAt: time.Now(),
		},
	}
	for _, opt := range opts {
		if err := opt(r); err != nil {
			return err
		}
	}
	// don't even store the entry if it's not valid already
	if !r.Metadata.IsValid() {
		return nil
	}
	keyRecord := KeyRecord{
		Key:    key,
		Record: r,
	}

	mount, err := c.findMount(key)
	if err != nil {
		return err
	}

	unlock, ok := mount.Lock(ctx)
	if !ok {
		return ErrLockFailed
	}
	defer unlock()

	return mount.Put(ctx, keyRecord)
}

func (c *cache) Read(ctx context.Context, key string) ([]byte, *Metadata, error) {
	mount, err := c.findMount(key)
	if err != nil {
		return nil, nil, err
	}

	unlock, ok := mount.Lock(ctx)
	if !ok {
		return nil, nil, ErrLockFailed
	}
	defer unlock()

	keyRecord, err := mount.Get(ctx, key)
	if err != nil {
		return nil, nil, err
	}

	md := keyRecord.Record.Metadata

	// this record is not valid anymore so we don't return it.
	if !md.IsValid() {
		return nil, nil, nil
	}

	// immediately delete the cache record if burn-after-reading
	// is enabled.
	// TODO(ppacher): should we only mark the record and use the gcLoop for
	//				  deletion?
	if md.BurnAfterReading {
		if err := mount.Delete(ctx, key); err != nil {
			// TODO(ppacher): how should we handle this error?
			return keyRecord.Record.Data, &md, err
		}
	}
	return keyRecord.Record.Data, &md, err
}

func (c *cache) Delete(ctx context.Context, key string) error {
	mount, err := c.findMount(key)
	if err != nil {
		return err
	}

	unlock, ok := mount.Lock(ctx)
	if !ok {
		return ErrLockFailed
	}
	defer unlock()

	return mount.Delete(ctx, key)
}

func (c *cache) List(ctx context.Context, prefix string) ([]string, error) {
	mount, err := c.findMount(prefix)
	if err != nil {
		return nil, err
	}

	unlock, ok := mount.Lock(ctx)
	if !ok {
		return nil, ErrLockFailed
	}
	defer unlock()

	records, err := mount.List(ctx, prefix)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve list: %w", err)
	}

	var keys []string
	for _, r := range records {
		if !r.Record.IsValid() {
			continue
		}
		keys = append(keys, r.Key)
	}
	return keys, nil
}

func (c *cache) findMount(path string) (*Mount, error) {
	path = trimPath(path)
	for mount, store := range c.mounts {
		if strings.HasPrefix(path, mount) {
			return store, nil
		}
	}
	return nil, ErrNoMatchingMount
}

func cloneRecord(r *Record) Record {
	c := new(Record)
	c.Metadata = r.Metadata
	if r.Metadata.NotValidAfter != nil {
		var v time.Time = *r.Metadata.NotValidAfter
		c.Metadata.NotValidAfter = &v
	}
	c.Data = make([]byte, len(r.Data))
	copy(c.Data, r.Data)
	return *c
}

func trimPath(path string) string {
	return strings.TrimSuffix(
		strings.TrimPrefix(
			path,
			"/",
		),
		"/",
	)
}
