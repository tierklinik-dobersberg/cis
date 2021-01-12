package calllogdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Database supports storing and retrieving of calllog records.
type Database interface {
	// Create creates new new calllog record.
	Create(ctx context.Context, d time.Time, caller string, inboundNumber string) error

	// ForDate returns all calllogs recorded at d.
	ForDate(ctx context.Context, d time.Time) ([]v1alpha.CallLog, error)
}

type database struct {
	callogs *mongo.Collection
}

// NewWithClient creates a new client.
func NewWithClient(ctx context.Context, dbName string, cli *mongo.Client) (Database, error) {
	db := &database{
		callogs: cli.Database(dbName).Collection("callogs"),
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	ind, err := db.callogs.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.M{
			"dateStr": 1,
		},
		Options: options.Index().SetSparse(false),
	})
	if err != nil {
		return fmt.Errorf("failed to create index")
	}

	logger.Infof(ctx, "Created index %s", ind)
	return nil
}

func (db *database) Create(ctx context.Context, d time.Time, caller string, inboundNumber string) error {
	log := v1alpha.CallLog{
		Caller:        caller,
		InboundNumber: inboundNumber,
		Date:          d,
		DateStr:       d.Format("2006-01-02"),
	}

	result, err := db.callogs.InsertOne(ctx, log)
	if err != nil {
		return err
	}

	// Just make sure the result is what we expect.
	if id, ok := result.InsertedID.(primitive.ObjectID); ok {
		log.ID = id
	} else {
		logger.From(ctx).Errorf("invalid type in result.InsertedID, expected primitive.ObjectID but got %T", result.InsertedID)
	}

	return nil
}

func (db *database) ForDate(ctx context.Context, d time.Time) ([]v1alpha.CallLog, error) {
	key := d.Format("2006-01-02")
	result, err := db.callogs.Find(ctx, bson.M{"dateStr": key})
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}

	var records []v1alpha.CallLog
	if err := result.All(ctx, &records); err != nil {
		return nil, err
	}

	return records, nil
}
