package cache

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoStore struct {
	l          sync.Mutex
	locked     uint32
	collection *mongo.Collection
}

// NewMongoStore returns a new cache.Store that perists all cache items it
// a mongo db collection.
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

	res := ms.collection.FindOne(ctx, bson.M{
		"key": key,
	})
	if res.Err() != nil {
		if errors.Is(res.Err(), mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, res.Err()
	}

	var kr KeyRecord
	if err := res.Decode(&kr); err != nil {
		return nil, fmt.Errorf("decoding record: %w", err)
	}
	return &kr, nil
}

func (ms *mongoStore) Put(ctx context.Context, r KeyRecord) error {
	ms.assertLocked()

	opts := options.Replace().
		SetUpsert(true)

	_, err := ms.collection.ReplaceOne(ctx, bson.M{
		"key": r.Key,
	}, r, opts)
	if err != nil {
		return err
	}
	return nil
}

func (ms *mongoStore) Delete(ctx context.Context, key string) error {
	ms.assertLocked()

	res, err := ms.collection.DeleteOne(ctx, bson.M{
		"key": key,
	})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (ms *mongoStore) List(ctx context.Context, prefix string) ([]*KeyRecord, error) {
	var res []*KeyRecord
	cursor, err := ms.collection.Find(ctx, bson.M{
		"key": bson.M{
			"$regex":   "^" + prefix,
			"$options": "i",
		},
	})
	if err != nil {
		return nil, fmt.Errorf("finding documents: %w", err)
	}

	if err := cursor.All(ctx, &res); err != nil {
		return nil, fmt.Errorf("decoding from cursor: %w", err)
	}
	return res, nil
}

// Compile time check
var _ Store = new(mongoStore)
