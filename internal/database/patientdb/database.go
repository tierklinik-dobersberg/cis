package patientdb

import (
	"context"
	"errors"
	"fmt"

	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
	"github.com/tierklinik-dobersberg/cis/pkg/models/patient/v1alpha"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("patientdb")

const CollectionName = "patients"

var ErrNotFound = errors.New("patient not found")

type Database interface {
	CreatePatient(ctx context.Context, record *v1alpha.PatientRecord) error
	Search(ctx context.Context, opts *SearchOptions) ([]v1alpha.PatientRecord, error)
	UpdatePatient(ctx context.Context, record *v1alpha.PatientRecord) error
	DeletePatient(ctx context.Context, id string) error
	ByCustomerAndAnimalID(ctx context.Context, source string, cid int, aid string) (*v1alpha.PatientRecord, error)
}

type database struct {
	collection *mongo.Collection
}

func NewWithClient(ctx context.Context, dbName string, cli *mongo.Client) (Database, error) {
	db := &database{
		collection: cli.Database(dbName).Collection(CollectionName),
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	if _, err := db.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.M{
				"customerSource": 1,
				"customerID":     1,
			},
		},
	}); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}
	return nil
}

func (db *database) CreatePatient(ctx context.Context, record *v1alpha.PatientRecord) error {
	if !record.ID.IsZero() {
		return httperr.BadRequest(nil, "cannot create with existing ID")
	}

	result, err := db.collection.InsertOne(ctx, record)
	if err != nil {
		return err
	}

	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		log.From(ctx).Errorf("invalid type in result.InsertedID, expected primitv.ObjectID but got %T", result.InsertedID)
	} else {
		record.ID = id
	}

	return nil
}

func (db *database) UpdatePatient(ctx context.Context, record *v1alpha.PatientRecord) error {
	if record.ID.IsZero() {
		return httperr.BadRequest(nil, "cannot update without ID")
	}

	result, err := db.collection.UpdateOne(
		ctx,
		bson.M{"_id": record.ID},
		bson.M{"$set": record},
	)
	if err != nil {
		return err
	}

	if result.ModifiedCount != 1 || result.MatchedCount != 1 {
		return fmt.Errorf("Expected to update one patient but matched %d and modified %d", result.MatchedCount, result.ModifiedCount)
	}
	return nil
}

func (db *database) ByCustomerAndAnimalID(ctx context.Context, source string, cid int, aid string) (*v1alpha.PatientRecord, error) {
	result := db.collection.FindOne(ctx, bson.M{
		"customerSource": source,
		"customerID":     cid,
		"animalID":       aid,
	})
	if result.Err() != nil {
		if errors.Is(result.Err(), mongo.ErrNoDocuments) {
			key := fmt.Sprintf("%s/%d/%s", source, cid, aid)
			return nil, httperr.NotFound("patient", key, ErrNotFound)
		}
		return nil, result.Err()
	}

	var record v1alpha.PatientRecord
	if err := result.Decode(&record); err != nil {
		return nil, err
	}
	return &record, nil
}

func (db *database) DeletePatient(ctx context.Context, id string) error {
	dbid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return httperr.BadRequest(err)
	}

	result, err := db.collection.DeleteOne(ctx, bson.M{"_id": dbid})
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrNotFound
		}
		return err
	}

	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (db *database) Search(ctx context.Context, filter *SearchOptions) ([]v1alpha.PatientRecord, error) {
	opts := options.Find().SetSort(bson.M{
		"customerSource": 1,
		"customerID":     1,
		"animalID":       -1,
	})
	result, err := db.collection.Find(ctx, filter.Build(), opts)
	if err != nil {
		return nil, err
	}
	if result.Err() != nil {
		if errors.Is(result.Err(), mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, result.Err()
	}

	var records []v1alpha.PatientRecord
	if err := result.All(ctx, &records); err != nil {
		return nil, err
	}
	return records, nil
}
