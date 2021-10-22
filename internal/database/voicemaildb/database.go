package voicemaildb

import (
	"context"
	"errors"

	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/voicemail/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("voicemaildb")

// Database defines the interface to create and search for voicemail
// records.
type Database interface {
	Create(ctx context.Context, record *v1alpha.VoiceMailRecord) error
	Search(ctx context.Context, opt *SearchOptions) ([]v1alpha.VoiceMailRecord, error)
	UpdateSeenFlag(ctx context.Context, id string, seen bool) error
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
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys:    bson.D{{Key: "datestr", Value: 1}},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys:    bson.D{{Key: "from", Value: 1}},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys: bson.D{
				{Key: "customerID", Value: 1},
				{Key: "customerSource", Value: 1},
			},
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

	go db.fireEvent(context.Background(), record.ID.Hex(), true)

	return nil
}

func (db *database) ByID(ctx context.Context, id string) (*v1alpha.VoiceMailRecord, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, httperr.BadRequest(err)
	}
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

func (db *database) UpdateSeenFlag(ctx context.Context, id string, seen bool) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return httperr.BadRequest(err)
	}

	result, err := db.collection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{
		"$set": bson.M{
			"read": seen,
		},
	})
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return httperr.NotFound("voicemail", id, err)
		}
		return err
	}

	if result.MatchedCount != 1 {
		return httperr.NotFound("voicemail", id, nil)
	}

	go db.fireEvent(context.Background(), id, false)

	return nil
}

func (db *database) Search(ctx context.Context, opt *SearchOptions) ([]v1alpha.VoiceMailRecord, error) {
	filter := opt.Build()
	log.From(ctx).Infof("Searching voicemails for %+v", filter)
	return db.findRecords(ctx, filter)
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
