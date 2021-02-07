package mailsync

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/mxk/go-imap/imap"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/mailbox"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// CollectionName is the name of the mail-sync mongodb
// collection.
const CollectionName = "mail-sync-state"

// State is the state of a mail syncer.
type State struct {
	// ID is the MongoDB object ID.
	ID primitive.ObjectID `bson:"_id,omitempty"`
	// Name is the name of the mail syncer the
	// state belongs to.
	Name string `bson:"name,omitempty"`
	// UIDValidtity is the last UIDVALIDITY value
	// seen.
	UIDValidity uint32 `bson:"uidValidity,omitempty"`
	// LastUIDFetched is the last mail UID that has
	// been fetched.
	// Only valid if UIDValidity is still unchanged.
	LastUIDFetched uint32 `bson:"lastUidFetched,omitempty"`
}

// MessageHandler is called for each new E-Mail that has been received
// by the watched mailbox.
type MessageHandler interface {
	HandleMail(ctx context.Context, mail *mailbox.EMail)
}

// MessageHandlerFunc is a convenience type for implementing
// MessageHandler
type MessageHandlerFunc func(context.Context, *mailbox.EMail)

// HandleMail implements MessageHandler.
func (fn MessageHandlerFunc) HandleMail(ctx context.Context, mail *mailbox.EMail) {
	fn(ctx, mail)
}

// Syncer syncs mails with mongodb.
type Syncer struct {
	rw           sync.Mutex
	state        State
	close        chan struct{}
	syncState    *mongo.Collection
	cfg          *mailbox.Config
	handler      MessageHandler
	pollInterval time.Duration
	wg           sync.WaitGroup
	log          logger.Logger
}

// OnMessage configures the message handler.
func (sync *Syncer) OnMessage(handler MessageHandler) {
	sync.rw.Lock()
	defer sync.rw.Unlock()

	sync.handler = handler
}

// Start starts the syncer.
func (sync *Syncer) Start() error {
	sync.rw.Lock()
	defer sync.rw.Unlock()

	if sync.close != nil {
		return fmt.Errorf("already running")
	}
	sync.close = make(chan struct{})

	sync.wg.Add(1)
	go func() {
		defer sync.wg.Done()
		defer func() {
			sync.rw.Lock()
			defer sync.rw.Unlock()

			sync.close = nil
		}()

		for {
			sync.poll()
			sync.log.Infof("waiting for %s next polling interval", sync.pollInterval)

			select {
			case <-sync.close:
				return
			case <-time.After(sync.pollInterval):
			}
		}
	}()

	return nil
}

func (sync *Syncer) poll() {
	defer func() {
		if x := recover(); x != nil {
			sync.log.Errorf("recovered panic: %v", x)
		}
	}()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cli, err := mailbox.Connect(*sync.cfg)
	if err != nil {
		sync.log.Errorf("failed to connect: %w", err)
		return
	}
	defer cli.IMAP.Logout(time.Second * 2)

	if cli.IMAP.Mailbox.UIDValidity != sync.state.UIDValidity {
		sync.log.Infof("mailbox UID validity changed from %d to %d", sync.state.UIDValidity, cli.IMAP.Mailbox.UIDValidity)
		sync.state.LastUIDFetched = 0
		sync.state.UIDValidity = cli.IMAP.Mailbox.UIDValidity

		// TODO(ppacher):
	}

	seqset := new(imap.SeqSet)
	seqset.AddRange(sync.state.LastUIDFetched, 0)

	sync.log.Infof("Searching for new mails in %s", seqset.String())
	mails, err := cli.FetchUIDs(ctx, seqset)
	if err != nil {
		sync.log.Errorf("failed to fetch mails: %s", err)
		return
	}

	var highestUID uint32
	count := 0
	for mail := range mails {
		if mail.Err != nil {
			sync.log.Errorf("failed to fetch mail: %s", err)
			continue
		}

		if mail.UID <= sync.state.LastUIDFetched {
			// we've already processed this mail.
			continue
		}

		handlerCtx := logger.With(ctx, sync.log.WithFields(logger.Fields{
			"uid":     mail.UID,
			"subject": mail.Subject,
			"from":    mail.From.Address,
		}))

		sync.handler.HandleMail(handlerCtx, mail.EMail)
		if mail.UID > highestUID {
			highestUID = mail.UID
			sync.updateState(handlerCtx, cli.IMAP.Mailbox.UIDValidity, highestUID)
		}
		count++
	}

	sync.log.Infof("processed %d new mails", count)
}

func (sync *Syncer) updateState(ctx context.Context, uidvalidtity uint32, lastUID uint32) {
	sync.state.LastUIDFetched = lastUID
	sync.state.UIDValidity = uidvalidtity

	if sync.state.ID.IsZero() {
		result, err := sync.syncState.InsertOne(ctx, sync.state)
		if err != nil {
			sync.log.Errorf("failed to create sync state: %s", err)
			return
		}

		sync.state.ID = result.InsertedID.(primitive.ObjectID)
	} else {
		_, err := sync.syncState.ReplaceOne(ctx, bson.M{"_id": sync.state.ID}, sync.state)
		if err != nil {
			sync.log.Errorf("failed to update sync state: %s", err)
			return
		}
	}
}

// Stop stops the syncer.
func (sync *Syncer) Stop() error {
	sync.rw.Lock()
	if sync.close == nil {
		sync.rw.Unlock()
		return fmt.Errorf("not running")
	}
	close(sync.close)
	sync.rw.Unlock()

	sync.wg.Wait()
	return nil
}
