package rosterdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("rosterdb")

// DutyRosterCollection is the MongoDB collection name for the
// duty roster.
const DutyRosterCollection = "dutyRoster"

// OverwriteJournal is used to keep track of emergency-duty-overwrites.
const OverwriteJournal = "dutyRosterOverwrites"

// Database is the database interface for the duty rosters.
type Database interface {
	// Create creates a new duty roster.
	Create(ctx context.Context, month time.Month, year int, days map[int]v1alpha.Day) error

	// Update updates an existing duty roster.
	Update(ctx context.Context, roster *v1alpha.DutyRoster) error

	// ForMonth returns the duty roster for the given month.
	ForMonth(ctx context.Context, month time.Month, year int) (*v1alpha.DutyRoster, error)

	// ForDay returns the roster for the day specified by t.
	ForDay(ctx context.Context, t time.Time) (*v1alpha.Day, error)

	// Delete deletes a roster.
	Delete(ctx context.Context, month time.Month, year int) error

	// SetOverwrite configures an emergency doctor-on-duty overwrite for the
	// given date.
	SetOverwrite(ctx context.Context, date time.Time, user, phone, displayName string) error

	// GetOverwrite returns any overwrite configured for date.
	GetOverwrite(ctx context.Context, date time.Time) (*v1alpha.Overwrite, error)

	// DeleteOverwrite deletes the roster overwrite for the given
	// day.
	DeleteOverwrite(ctx context.Context, date time.Time) error
}

type database struct {
	cli        *mongo.Client
	rosters    *mongo.Collection
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
		rosters:    client.Database(dbName).Collection(DutyRosterCollection),
		overwrites: client.Database(dbName).Collection(OverwriteJournal),
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	// we use a compound index on month and year that must be unique.
	_, err := db.rosters.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.M{
			"month": 1,
			"year":  1,
		},
		Options: options.Index().SetUnique(true).SetSparse(false),
	})
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	// TODO(ppacher): find migration strategy
	_, err = db.overwrites.Indexes().DropOne(ctx, "date_1")
	if err != nil {
		log.From(ctx).Errorf("failed to drop index date_1: %s", err)
	}

	_, err = db.overwrites.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.M{
			"date": 1,
		},
		// we don't use a unique index here because we only "mark" overwrites
		// as deleted instead of actually deleting them.
		Options: options.Index().SetSparse(false),
	})
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	return nil
}

func (db *database) Create(ctx context.Context, month time.Month, year int, days map[int]v1alpha.Day) error {
	roster := &v1alpha.DutyRoster{
		Month: month,
		Year:  year,
		Days:  days,
	}

	// Don't care about overwrites here as our unique compound index will refuse it
	// anyway.
	result, err := db.rosters.InsertOne(ctx, roster)
	if err != nil {
		return err
	}

	// Just make sure the result is what we expect.
	if id, ok := result.InsertedID.(primitive.ObjectID); ok {
		roster.ID = id
	} else {
		log.From(ctx).Errorf("invalid type in result.InsertedID, expected primitive.ObjectID but got %T", result.InsertedID)
	}

	go db.fireChangeEvent(ctx, month, year)

	return nil
}

func (db *database) Update(ctx context.Context, roster *v1alpha.DutyRoster) error {
	if roster == nil {
		return fmt.Errorf("invalid roster")
	}

	result, err := db.rosters.ReplaceOne(ctx, bson.M{"year": roster.Year, "month": roster.Month}, roster)
	if err != nil {
		return err
	}

	if result.MatchedCount != 1 || result.ModifiedCount != 1 {
		return fmt.Errorf("failed to update roster. matched=%d modified=%d", result.MatchedCount, result.ModifiedCount)
	}

	go db.fireChangeEvent(ctx, roster.Month, roster.Year)

	return nil
}

func (db *database) ForMonth(ctx context.Context, month time.Month, year int) (*v1alpha.DutyRoster, error) {
	result := new(v1alpha.DutyRoster)

	res := db.rosters.FindOne(ctx, bson.M{"month": month, "year": year})
	if err := res.Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("roster", fmt.Sprintf("%04d/%02d", year, month), ErrNotFound)
		}
		return nil, err
	}

	if err := res.Decode(result); err != nil {
		return nil, err
	}

	return result, nil
}

func (db *database) ForDay(ctx context.Context, t time.Time) (*v1alpha.Day, error) {
	roster, err := db.ForMonth(ctx, t.Month(), t.Year())
	if err != nil {
		return nil, err
	}

	day, ok := roster.Days[t.Day()]
	if !ok {
		key := fmt.Sprintf("%04d/%02d", t.Year(), t.Month())
		return nil, httperr.NotFound("roster-day", key, nil)
	}
	return &day, nil
}

func (db *database) Delete(ctx context.Context, month time.Month, year int) error {
	res, err := db.rosters.DeleteOne(ctx, bson.M{"month": month, "year": year})
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return httperr.NotFound("roster", fmt.Sprintf("%04d/%02d", year, month), ErrNotFound)
		}
		return err
	}

	if res.DeletedCount < 1 {
		return httperr.NotFound("roster", fmt.Sprintf("%04d/%02d", year, month), ErrNotFound)
	}

	go db.fireDeleteEvent(ctx, month, year)

	return nil
}

func (db *database) SetOverwrite(ctx context.Context, d time.Time, user, phone, displayName string) error {
	dstr := d.Format("2006-01-02")
	if user == "" && phone == "" {
		return httperr.BadRequest(nil, "Username and phone number not set")
	}

	overwrite := v1alpha.Overwrite{
		Date:        dstr,
		Username:    user,
		PhoneNumber: phone,
		DisplayName: displayName,
		CreatedAt:   time.Now(),
		// TODO(ppacher): CreatedBy
		Deleted: false,
	}

	log := log.From(ctx).WithFields(logger.Fields{
		"date":  dstr,
		"user":  user,
		"phone": phone,
	})

	// update any exsiting entry  as "deleted"
	// although there should only ever be one document with dstr and delete=false
	// but make sure we mark every other one as well.
	_, err := db.overwrites.UpdateMany(
		ctx,
		bson.M{
			"date":    dstr,
			"deleted": bson.M{"$ne": true},
		},
		bson.M{
			"$set": bson.M{
				"deleted": true,
			},
		},
	)
	if err != nil {
		return err
	}

	// create a new one.
	if _, err := db.overwrites.InsertOne(ctx, overwrite); err != nil {
		return err
	}

	log.Infof("created new roster overwrite")

	go db.fireOverwriteEvent(ctx, d, user, phone, displayName)

	return nil

}

func (db *database) GetOverwrite(ctx context.Context, d time.Time) (*v1alpha.Overwrite, error) {
	res := db.overwrites.FindOne(ctx, bson.M{
		"date":    d.Format("2006-01-02"),
		"deleted": bson.M{"$ne": true},
	})
	if res.Err() != nil {
		if errors.Is(res.Err(), mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("overwrite", d.String(), res.Err())
		}
		return nil, res.Err()
	}

	var o v1alpha.Overwrite
	if err := res.Decode(&o); err != nil {
		return nil, err
	}
	return &o, nil
}

func (db *database) DeleteOverwrite(ctx context.Context, d time.Time) error {
	res, err := db.overwrites.UpdateMany(
		ctx,
		bson.M{
			"date":    d.Format("2006-01-02"),
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
			return httperr.NotFound("overwrite", d.Format("2006-01-02"), err)
		}

		return err
	}

	if res.ModifiedCount == 0 {
		return httperr.NotFound("overwrite", d.Format("2006-01-02"), nil)
	}

	go db.fireOverwriteDeleteEvent(ctx, d)

	return nil
}
