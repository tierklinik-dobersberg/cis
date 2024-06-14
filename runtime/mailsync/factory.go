package mailsync

import (
	"context"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/mailbox"
)

var log = pkglog.New("mailsync")

// Manager manages mail syncers and persists their state in
// a store.
type Manager struct {
	//syncState *mongo.Collection
	syncState Store
}

// NewManagerreturns a new mailsync manager that uses the given
// MongoDB client and database.
func NewManager(ctx context.Context, store Store) (*Manager, error) {
	mng := &Manager{
		syncState: store,
	}

	return mng, nil
}

// NewSyncer returns a new.
func (mng *Manager) NewSyncer(ctx context.Context, name string, interval time.Duration, cfg *mailbox.Config) (*Syncer, error) {
	log := log.From(ctx)

	state, err := mng.syncState.LoadState(ctx, name)
	if err != nil {
		return nil, err
	}
	if state == nil {
		// this is a new syncer and there wasn't any state before.
		state = new(State)
	}
	state.Name = name

	syncer := &Syncer{
		state:        *state,
		syncState:    mng.syncState,
		cfg:          cfg,
		pollInterval: interval,
		log: log.WithFields(logger.Fields{
			"mailbox": name,
		}),
	}

	return syncer, nil
}
