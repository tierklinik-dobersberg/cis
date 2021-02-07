package voicemaildb

import (
	"context"
	"errors"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/voicemail/v1alpha"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Database defines the interface to create and search for voicemail
// records.
type Database interface {
	Create(ctx context.Context, record *v1alpha.VoiceMailRecord) error
	ForDate(ctx context.Context, voicemailName string, d time.Time) ([]v1alpha.VoiceMailRecord, error)
	ForCustomer(ctx context.Context, voicemailName string, source, id string) ([]v1alpha.VoiceMailRecord, error)
	ByID(ctx context.Context, id string) (*v1alpha.VoiceMailRecord, error)
}

// VoicemailCollection is the mongodb collection name.
var VoicemailCollection = "voicemails"

type database struct {
	collection *mongo.Collection
}

// NewWithClient returns a new voicmaildb client.
func NewWithClient(ctx context.Context, dbName string, cli *mongo.Client) (Database, error) {
	db := &database{
		collection: cli.Database(dbName).Collection(VoicemailCollection),
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	_, err := db.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.M{"name": 1},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys:    bson.M{"datestr": 1},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys:    bson.M{"from": 1},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys:    bson.M{"customerID": 1, "customerSource": 1},
			Options: options.Index().SetSparse(true),
		},
	})
	if err != nil {
		return err
	}
	return nil
}

func (db *database) Create(ctx context.Context, record *v1alpha.VoiceMailRecord) error {
	record.DateStr = record.Date.Format("2006-01-02")

	result, err := db.collection.InsertOne(ctx, record)
	if err != nil {
		return err
	}

	record.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (db *database) ForDate(ctx context.Context, name string, d time.Time) ([]v1alpha.VoiceMailRecord, error) {
	filter := bson.M{
		"datestr": d.Format("2006-01-02"),
	}
	if name != "" {
		filter["name"] = name
	}
	return db.findRecords(ctx, filter)
}

func (db *database) ForCustomer(ctx context.Context, name, source, id string) ([]v1alpha.VoiceMailRecord, error) {
	filter := bson.M{
		"customerID":     id,
		"customerSource": source,
	}
	if name != "" {
		filter["name"] = name
	}
	return db.findRecords(ctx, filter)
}

func (db *database) ByID(ctx context.Context, id string) (*v1alpha.VoiceMailRecord, error) {
	objID, _ := primitive.ObjectIDFromHex(id)
	result := db.collection.FindOne(ctx, bson.M{"_id": objID})
	if result.Err() != nil {
		if errors.Is(result.Err(), mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("id", id, result.Err())
		}
		return nil, result.Err()
	}

	var r v1alpha.VoiceMailRecord
	if err := result.Decode(&r); err != nil {
		return nil, err
	}

	return &r, nil
}

func (db *database) findRecords(ctx context.Context, filter interface{}) ([]v1alpha.VoiceMailRecord, error) {
	opts := options.Find().SetSort(bson.M{
		"date": -1,
	})
	result, err := db.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}

	if result.Err() != nil {
		if errors.Is(result.Err(), mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, result.Err()
	}

	var records []v1alpha.VoiceMailRecord
	if err := result.All(ctx, &records); err != nil {
		return nil, err
	}
	return records, nil
}
