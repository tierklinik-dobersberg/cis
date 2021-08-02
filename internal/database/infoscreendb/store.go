package infoscreendb

import (
	"context"
	"errors"
	"fmt"

	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/infoscreen/v1alpha"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// InfoScreenCollection is the MongoDB collection name
// that holds all infoscreen shows.
const InfoScreenCollection = "infoscreen"

type Database interface {
	// ListShowNames lists the names of all shows stored.
	ListShows(ctx context.Context) ([]v1alpha.ListShowEntry, error)

	// SaveShow saves a new slideshow
	SaveShow(ctx context.Context, show v1alpha.Show) error

	// GetShow returns the slideshow by name.
	GetShow(ctx context.Context, name string) (*v1alpha.Show, error)

	// DeleteShow deletes an existing slide show
	DeleteShow(ctx context.Context, name string) error
}

type database struct {
	cli   *mongo.Client
	shows *mongo.Collection
}

// NewWithClient is like New but uses an already existing mongodb client.
func NewWithClient(ctx context.Context, dbName string, client *mongo.Client) (Database, error) {
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	db := &database{
		cli:   client,
		shows: client.Database(dbName).Collection(InfoScreenCollection),
	}

	// prepare collections and indexes.
	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	_, err := db.shows.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.M{
				"name": 1,
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	return nil
}

func (db *database) ListShows(ctx context.Context) ([]v1alpha.ListShowEntry, error) {
	result, err := db.shows.Find(ctx, bson.M{})
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}

	var entries []v1alpha.ListShowEntry
	for result.Next(ctx) {
		var s v1alpha.Show
		if err := result.Decode(&s); err != nil {
			return nil, err
		}

		entries = append(entries, v1alpha.ListShowEntry{
			Name:           s.Name,
			NumberOfSlides: len(s.Slides),
			Description:    s.Description,
		})
	}

	return entries, nil
}

func (db *database) SaveShow(ctx context.Context, show v1alpha.Show) error {
	_, err := db.shows.ReplaceOne(
		ctx,
		bson.M{"name": show.Name},
		show,
		options.Replace().SetUpsert(true),
	)
	if err != nil {
		return err
	}
	return nil
}

func (db *database) GetShow(ctx context.Context, name string) (*v1alpha.Show, error) {
	result := db.shows.FindOne(
		ctx,
		bson.M{"name": name},
	)

	if result.Err() != nil {
		if errors.Is(result.Err(), mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("show", name, result.Err())
		}
		return nil, result.Err()
	}

	var show v1alpha.Show
	if err := result.Decode(&show); err != nil {
		return nil, err
	}

	return &show, nil
}

func (db *database) DeleteShow(ctx context.Context, name string) error {
	result, err := db.shows.DeleteOne(
		ctx,
		bson.M{"name": name},
	)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return httperr.NotFound("show", name, err)
		}
		return err
	}
	if result.DeletedCount != 1 {
		return httperr.NotFound("show", name, nil)
	}
	return nil
}
