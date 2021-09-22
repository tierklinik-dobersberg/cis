package schema

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Common error messages when working with the schema package:
var (
	ErrNotFound = errors.New("not found")
)

// CollectionName is the name of the mongo-db collection used
// to store schema migrations.
const CollectionName = "cis:schema"

// MigrationRecord defines the record stored in the mongodb schema
// collection and represents a successfully applied migration.
type MigrationRecord struct {
	// Key is the key of the subsystem the migration applies to.
	Key string `json:"key" bson:"key"`
	// Version is the version of the subsystem after this migration
	// executed.
	Version string `json:"version" bson:"version"`
	// MigratedAt holds the time the migration was applied.
	MigratedAt time.Time `json:"migratedAt" bson:"migratedAt"`
}

// Database stores schema and applied migrations.
type Database interface {
	// Load should return the migration record stored at key.
	Load(ctx context.Context, key string) (*MigrationRecord, error)
	// Save should create a new migration record for key and version
	// overwritting any previously created migration record with the
	// same key.
	Save(ctx context.Context, key, version string) error
}

type database struct {
	col *mongo.Collection
}

// NewDatabaseFromClient returns a new schema database.
func NewDatabaseFromClient(ctx context.Context, dbName string, cli *mongo.Client) (Database, error) {
	db := &database{
		col: cli.Database(dbName).Collection(CollectionName),
	}

	return db, nil
}

func (db *database) Load(ctx context.Context, key string) (*MigrationRecord, error) {
	res := db.col.FindOne(ctx, bson.M{
		"key": key,
	})
	if res.Err() != nil {
		if errors.Is(res.Err(), mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, res.Err()
	}

	var record MigrationRecord
	if err := res.Decode(&record); err != nil {
		return nil, err
	}
	return &record, nil
}

func (db *database) Save(ctx context.Context, key, version string) error {
	record := MigrationRecord{
		Key:        key,
		Version:    version,
		MigratedAt: time.Now(),
	}
	opts := options.Update().SetUpsert(true)
	res, err := db.col.UpdateOne(ctx, bson.M{"key": key}, bson.M{
		"$set": record,
	}, opts)
	if err != nil {
		return err
	}
	if res.ModifiedCount != 1 && res.UpsertedCount != 1 {
		return fmt.Errorf("failed to save migration record")
	}
	return nil
}
