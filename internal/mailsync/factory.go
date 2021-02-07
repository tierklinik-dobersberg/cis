package mailsync

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/mailbox"
	"go.mongodb.org/mongo-driver/bson"
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

// NewSyncer returns a new
func (mng *Manager) NewSyncer(ctx context.Context, name string, interval time.Duration, cfg *mailbox.Config) (*Syncer, error) {
	result := mng.syncState.FindOne(ctx, bson.M{"name": name})
	if result.Err() != nil && !errors.Is(result.Err(), mongo.ErrNoDocuments) {
		return nil, fmt.Errorf("loading state: %w", result.Err())
	}

	var state State
	state.Name = name

	if result.Err() == nil {
		if err := result.Decode(&state); err != nil {
			return nil, fmt.Errorf("decoding state: %w", err)
		}
	}

	cli, err := mailbox.Connect(*cfg)
	if err != nil {
		return nil, err
	}
	defer cli.IMAP.Logout(time.Second * 5)

	syncer := &Syncer{
		state:        state,
		syncState:    mng.syncState,
		cfg:          cfg,
		pollInterval: interval,
		log: logger.From(ctx).WithFields(logger.Fields{
			"mailbox": name,
		}),
	}

	return syncer, nil
}
