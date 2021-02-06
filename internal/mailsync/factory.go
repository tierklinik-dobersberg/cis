package mailsync

import (
	"context"

	"go.mongodb.org/mongo-driver/mongo"
)

// Manager manages mail syncers and persists their state in
// a mongodb collection.
type Manager struct {
	syncState *mongo.Collection
}

// NewManagerWithClient returns a new mailsync manager that uses the given
// MongoDB client and database.
func NewManagerWithClient(ctx context.Context, dbName string, cli *mongo.Client) (*Manager, error) {
	mng := &Manager{
		syncState: cli.Database(dbName).Collection(CollectionName),
	}

	if err := mng.setup(ctx); err != nil {
		return nil, err
	}

	return mng, nil
}

func (mng *Manager) setup(ctx context.Context) error {
	return nil
}
