package cache

import (
	"context"
	"sync"
	"sync/atomic"

	"go.mongodb.org/mongo-driver/mongo"
)

type mongoStore struct {
	l          sync.Mutex
	locked     uint32
	collection *mongo.Collection
}

func NewMongoStore(ctx context.Context, dbName, collectionName string, cli *mongo.Client) Store {
	s := &mongoStore{
		collection: cli.Database(dbName).Collection(collectionName),
	}

	return s
}

func (ms *mongoStore) Lock(ctx context.Context) (UnlockFunc, bool) {
	ms.l.Lock()
	if atomic.SwapUint32(&ms.locked, 1) == 1 {
		panic("cache.Store already locked")
	}
	return func() {
		defer ms.l.Unlock()
		if atomic.SwapUint32(&ms.locked, 0) != 1 {
			panic("cache.Store not locked")
		}
	}, true
}

func (ms *mongoStore) assertLocked() {
	if atomic.LoadUint32(&ms.locked) != 1 {
		panic("cache.Store not locked")
	}
}

func (ms *mongoStore) Get(ctx context.Context, key string) (*KeyRecord, error) {
	ms.assertLocked()

	return nil, nil
}

func (ms *mongoStore) Put(ctx context.Context, r KeyRecord) error {
	ms.assertLocked()

	return nil
}

func (ms *mongoStore) Delete(ctx context.Context, key string) error {
	ms.assertLocked()

	return nil
}

func (ms *mongoStore) List(ctx context.Context, prefix string) ([]*KeyRecord, error) {
	return nil, nil
}
