package oncalloverwrite

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("rosterdb")

// OverwriteJournal is used to keep track of emergency-duty-overwrites.
const OverwriteJournal = "dutyRosterOverwrites"

// Database is the database interface for the duty rosters.
type Database interface {
	// CreateOverwrite configures an emergency doctor-on-duty overwrite for the
	// given date.
	CreateOverwrite(ctx context.Context, from, to time.Time, userID, phone, displayName string) (v1alpha.Overwrite, error)

	// GetOverwrite returns the currently active overwrite for the given date/time.
	GetActiveOverwrite(ctx context.Context, date time.Time) (*v1alpha.Overwrite, error)

	// GetOverwrites returns all overwrites that have start or time between from and to.
	GetOverwrites(ctx context.Context, from, to time.Time, includeDeleted bool) ([]*v1alpha.Overwrite, error)

	// DeleteOverwrite deletes the roster overwrite for the given
	// day.
	DeleteActiveOverwrite(ctx context.Context, date time.Time) error

	// DeleteOverwrite deletes the roster overwrite with the given ID
	DeleteOverwrite(ctx context.Context, id string) error
}

type database struct {
	cli        *mongo.Client
	overwrites *mongo.Collection
}

// New returns a new database by connecting to the mongoDB instance
// specified in url.
func New(ctx context.Context, url, dbName string) (Database, error) {
	clientConfig := options.Client().ApplyURI(url)
	client, err := mongo.NewClient(clientConfig)
	if err != nil {
		return nil, err
	}

	if err := client.Connect(ctx); err != nil {
		return nil, err
	}

	db, err := NewWithClient(ctx, dbName, client)
	if err != nil {
		defer func() {
			if err := client.Disconnect(ctx); err != nil {
				log.From(ctx).Errorf("failed to gracefully disconnect from MongoDB: %s", err)
			}
		}()
		return nil, err
	}

	return db, nil
}

// NewWithClient is like new but directly accepts the mongoDB client to use.
func NewWithClient(ctx context.Context, dbName string, client *mongo.Client) (Database, error) {
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	db := &database{
		cli:        client,
		overwrites: client.Database(dbName).Collection(OverwriteJournal),
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	// TODO(ppacher): find migration strategy
	_, err := db.overwrites.Indexes().DropOne(ctx, "date_1")
	if err != nil {
		log.From(ctx).Errorf("failed to drop index date_1: %s", err)
	}

	_, err = db.overwrites.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "from", Value: 1},
			{Key: "to", Value: 1},
		},
		// we don't use a unique index here because we only "mark" overwrites
		// as deleted instead of actually deleting them.
		Options: options.Index().SetUnique(false).SetSparse(false),
	})
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	return nil
}

func (db *database) CreateOverwrite(ctx context.Context, from, to time.Time, user, phone, displayName string) (v1alpha.Overwrite, error) {
	if user == "" && phone == "" {
		return v1alpha.Overwrite{}, httperr.BadRequest("Username and phone number not set")
	}

	overwrite := v1alpha.Overwrite{
		From:        from,
		To:          to,
		UserId:      user,
		PhoneNumber: phone,
		DisplayName: displayName,
		CreatedAt:   time.Now(),
		CreatedBy:   session.UserFromCtx(ctx).User.Id,
		Deleted:     false,
	}

	log := log.From(ctx).WithFields(logger.Fields{
		"from":  from,
		"to":    to,
		"user":  user,
		"phone": phone,
	})

	overlapping, err := db.GetOverwrites(ctx, from, to, false)
	if err != nil {
		return v1alpha.Overwrite{}, fmt.Errorf("failed to check for overlapping overwrites: %w", err)
	}

	if len(overlapping) > 0 {
		return v1alpha.Overwrite{}, httperr.Conflict(
			fmt.Sprintf("Found existing overwrites between %s and %s", from.Format(time.RFC3339), to.Format(time.RFC3339)),
		)
	}

	if res, err := db.overwrites.InsertOne(ctx, overwrite); err == nil {
		overwrite.ID = res.InsertedID.(primitive.ObjectID)
	} else {
		return v1alpha.Overwrite{}, fmt.Errorf("failed to insert overwrite: %w", err)
	}

	log.Infof("created new roster overwrite")

	go db.fireOverwriteEvent(ctx, from, to, user, phone, displayName)

	return overwrite, nil
}

func (db *database) GetOverwrites(ctx context.Context, filterFrom, filterTo time.Time, includeDeleted bool) ([]*v1alpha.Overwrite, error) {
	filter := bson.M{
		"$or": bson.A{
			bson.M{
				"from": bson.M{
					"$gte": filterFrom,
					"$lt":  filterTo,
				},
			},
			bson.M{
				"to": bson.M{
					"$gt": filterFrom,
					"$lt": filterTo,
				},
			},
			bson.M{
				"from": bson.M{"$lte": filterFrom},
				"to":   bson.M{"$gt": filterTo},
			},
		},
	}
	if !includeDeleted {
		filter["deleted"] = bson.M{"$ne": true}
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "from", Value: 1},
		{Key: "to", Value: 1},
		{Key: "_id", Value: 1},
	})

	res, err := db.overwrites.Find(ctx, filter, opts)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}

	var result []*v1alpha.Overwrite
	if err := res.All(ctx, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (db *database) GetActiveOverwrite(ctx context.Context, date time.Time) (*v1alpha.Overwrite, error) {
	log.From(ctx).Infof("[active-overwrite] searching database ...")
	res := db.overwrites.FindOne(ctx, bson.M{
		"from": bson.M{
			"$lte": date,
		},
		"to": bson.M{
			"$gt": date,
		},
		"deleted": bson.M{"$ne": true},
	})
	log.From(ctx).Infof("[active-overwrite] received result")

	if res.Err() != nil {
		if errors.Is(res.Err(), mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("overwrite", date.String()).SetInternal(res.Err())
		}
		return nil, res.Err()
	}

	log.From(ctx).Infof("[active-overwrite] decoding overwrite")
	var o v1alpha.Overwrite
	if err := res.Decode(&o); err != nil {
		return nil, err
	}
	return &o, nil
}

func (db *database) DeleteActiveOverwrite(ctx context.Context, d time.Time) error {
	res, err := db.overwrites.UpdateMany(
		ctx,
		bson.M{
			"from": bson.M{
				"$lte": d,
			},
			"to": bson.M{
				"$gt": d,
			},
			"deleted": bson.M{"$ne": true},
		},
		bson.M{
			"$set": bson.M{
				"deleted": true,
			},
		},
	)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return httperr.NotFound("overwrite", d.Format("2006-01-02")).SetInternal(err)
		}

		return err
	}

	if res.ModifiedCount == 0 {
		return httperr.NotFound("overwrite", d.Format("2006-01-02"))
	}

	// FIXME(ppacher): we use d for From and To here. Instead, we should actually
	// load all deleted overwrites from the database and fire a event for each of them.
	// Though, it should only be one ...
	// In either case, using d for From and To is wrong!
	go db.fireOverwriteDeleteEvent(ctx, d, d)

	return nil
}

func (db *database) DeleteOverwrite(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	res, err := db.overwrites.UpdateMany(
		ctx,
		bson.M{
			"_id":     oid,
			"deleted": bson.M{"$ne": true},
		},
		bson.M{
			"$set": bson.M{
				"deleted": true,
			},
		},
	)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return httperr.NotFound("overwrite", id).SetInternal(err)
		}
		return err
	}

	if res.ModifiedCount == 0 {
		return httperr.NotFound("overwrite", id)
	}

	// FIXME(ppacher): fire a overwrite deleted event here

	return nil
}
