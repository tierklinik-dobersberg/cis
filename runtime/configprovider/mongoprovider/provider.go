package mongoprovider

import (
	"context"
	"errors"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type record struct {
	ID primitive.ObjectID `bson:"_id,omitempty"`

	Key     string        `bson:"key"`
	Options []conf.Option `bson:"options"`
}

// MongoProvider is a runtime.ConfigProvider that stores configuration
// data in a mongodb collection.
type MongoProvider struct {
	collection *mongo.Collection
}

// New returns a new MongoDB backend runtime.ConfigProvider that stores
// configuration is a collection called colName inside the database dbName.
// Note that the database indexes should have been setup up already.
func New(cli *mongo.Client, dbName, colName string) *MongoProvider {
	col := cli.Database(dbName).Collection(colName)

	return &MongoProvider{
		collection: col,
	}
}

// Create stores a new configuration section in the database collection.
// It returns the ID of the new record along with any encountered error.
func (pr *MongoProvider) Create(ctx context.Context, sec conf.Section) (string, error) {
	res, err := pr.collection.InsertOne(ctx, record{
		Key:     strings.ToLower(sec.Name),
		Options: sec.Options,
	})
	if err != nil {
		return "", err
	}

	return res.InsertedID.(primitive.ObjectID).Hex(), nil
}

// Update an existing configuration object in the database collection.
// The object is identified by id and secType.
func (pr *MongoProvider) Update(ctx context.Context, id, secType string, opts []conf.Option) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	secType = strings.ToLower(secType)

	res, err := pr.collection.ReplaceOne(
		ctx,
		bson.M{
			"_id": oid,
			"key": secType,
		},
		record{
			ID:      oid,
			Key:     secType,
			Options: opts,
		},
	)
	if err != nil {
		return err
	}

	if res.MatchedCount == 0 {
		return runtime.ErrCfgSectionNotFound
	}
	return nil
}

// Delete a configuration object from the database collection.
func (pr *MongoProvider) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	res, err := pr.collection.DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		return err
	}

	if res.DeletedCount == 0 {
		return runtime.ErrCfgSectionNotFound
	}
	return nil
}

// Get a list of configuration objects of a given sectionType.
func (pr *MongoProvider) Get(ctx context.Context, sectionType string) ([]runtime.Section, error) {
	sectionType = strings.ToLower(sectionType)
	queryResult, err := pr.collection.Find(ctx, bson.M{"key": sectionType})
	if err != nil {
		return nil, err
	}

	var result []record
	if err := queryResult.All(ctx, &result); err != nil {
		return nil, err
	}

	var sections = make([]runtime.Section, len(result))
	for idx, r := range result {
		sections[idx] = runtime.Section{
			ID: r.ID.Hex(),
			Section: conf.Section{
				Name:    r.Key,
				Options: r.Options,
			},
		}
	}
	return sections, nil
}

// GetID returns a single configuration object identified by ID.
func (pr *MongoProvider) GetID(ctx context.Context, id string) (runtime.Section, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return runtime.Section{}, err
	}

	queryResult := pr.collection.FindOne(ctx, bson.M{"_id": oid})
	if queryResult.Err() != nil {
		if errors.Is(queryResult.Err(), mongo.ErrNoDocuments) {
			return runtime.Section{}, runtime.ErrCfgSectionNotFound
		}
		return runtime.Section{}, queryResult.Err()
	}

	var r record
	if err := queryResult.Decode(&r); err != nil {
		return runtime.Section{}, err
	}

	return runtime.Section{
		ID: r.ID.Hex(),
		Section: conf.Section{
			Name:    r.Key,
			Options: r.Options,
		},
	}, nil
}
