package rosterdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DutyRosterCollection is the MongoDB collection name for the
// duty roster.
const DutyRosterCollection = "dutyRoster"

// Database is the database interface for the duty rosters.
type Database interface {
	// Create creates a new duty roster.
	Create(ctx context.Context, month time.Month, year int, days map[int]v1alpha.Day) error

	// Update updates an existing duty roster.
	Update(ctx context.Context, roster *v1alpha.DutyRoster) error

	// ForMonth returns the duty roster for the given month.
	ForMonth(ctx context.Context, month time.Month, year int) (*v1alpha.DutyRoster, error)
}

type database struct {
	cli     *mongo.Client
	rosters *mongo.Collection
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
		defer client.Disconnect(ctx)
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
		cli:     client,
		rosters: client.Database(dbName).Collection(DutyRosterCollection),
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	// we use a compound index on month and year that must be unique.
	ind, err := db.rosters.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.M{
			"month": 1,
			"year":  1,
		},
		Options: options.Index().SetUnique(true).SetSparse(false),
	})
	if err != nil {
		return err
	}

	logger.Infof(ctx, "Created index %s", ind)
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
		logger.From(ctx).Errorf("invalid type in result.InsertedID, expected primitive.ObjectID but got %T", result.InsertedID)
	}

	return nil
}

func (db *database) Update(ctx context.Context, roster *v1alpha.DutyRoster) error {
	if roster == nil || roster.ID.IsZero() {
		return fmt.Errorf("invalid roster")
	}

	result, err := db.rosters.UpdateOne(ctx, bson.M{"_id": roster.ID}, bson.M{
		"$set": roster,
	})
	if err != nil {
		return err
	}

	if result.MatchedCount != 1 || result.ModifiedCount != 1 {
		return fmt.Errorf("failed to update roster. matched=%d modified=%d", result.MatchedCount, result.ModifiedCount)
	}

	return nil
}

func (db *database) ForMonth(ctx context.Context, month time.Month, year int) (*v1alpha.DutyRoster, error) {
	result := new(v1alpha.DutyRoster)

	res := db.rosters.FindOne(ctx, bson.M{"month": month, "year": year})
	if err := res.Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if err := res.Decode(result); err != nil {
		return nil, err
	}

	return result, nil
}
