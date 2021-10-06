package commentdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/comment/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("commentdb")

// CommentCollection is the MongoDB collection name
// that holds all comments.
const CommentCollection = "comments"

type Database interface {
	// Create creates a new comment.
	Create(ctx context.Context, key string, user, message string) (string, error)
	// Reply replies to a comment.
	Reply(ctx context.Context, id string, user, message string) (string, error)
	// ByID returns a singel comment by ID.
	ByID(ctx context.Context, id string) (*v1alpha.Comment, error)
	// ByKey returns all comments that are associated with key.
	ByKey(ctx context.Context, key string, prefix bool) ([]v1alpha.Comment, error)
}

type database struct {
	cli      *mongo.Client
	comments *mongo.Collection
}

// New connects to the MongoDB server at URL and returns
// a new database interface.
func New(ctx context.Context, url, dbName string) (Database, error) {
	clientConfig := options.Client().ApplyURI(url)
	client, err := mongo.NewClient(clientConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	// Try to connect
	if err := client.Connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to server %s: %w", url, err)
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

// NewWithClient is like New but uses an already existing mongodb client.
func NewWithClient(ctx context.Context, dbName string, client *mongo.Client) (Database, error) {
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	db := &database{
		cli:      client,
		comments: client.Database(dbName).Collection(CommentCollection),
	}

	// prepare collections and indexes.
	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	_, err := db.comments.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.M{
				"parentID": 1,
			},
		},
		{
			Keys: bson.M{
				"key": 1,
			},
		},
		{
			Keys: bson.M{
				"user": 1,
			},
		},
	})
	if err != nil {
		return fmt.Errorf("creating indexes: %w", err)
	}
	return nil
}

func (db *database) Create(ctx context.Context, key string, user, message string) (string, error) {
	c := v1alpha.Comment{
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Key:       key,
		User:      user,
		Message:   message,
	}

	result, err := db.comments.InsertOne(ctx, c)
	if err != nil {
		return "", fmt.Errorf("failed to insert comment: %w", err)
	}

	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return "", fmt.Errorf("failed to get ID of new comment, invalid type %T", result.InsertedID)
	}

	return id.String(), nil
}

func (db *database) Reply(ctx context.Context, id string, user, message string) (string, error) {
	parent, err := db.ByID(ctx, id)
	if err != nil {
		return "", err
	}

	c := v1alpha.Comment{
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Key:       parent.Key,
		ParentID:  parent.ID,
		User:      user,
		Message:   message,
	}

	result, err := db.comments.InsertOne(ctx, c)
	if err != nil {
		return "", err
	}

	cid, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return "", fmt.Errorf("failed to get ID of new comment, invalid type %T", result.InsertedID)
	}

	return cid.String(), nil
}

func (db *database) ByID(ctx context.Context, id string) (*v1alpha.Comment, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, httperr.BadRequest(err)
	}

	result := db.comments.FindOne(ctx, bson.M{
		"_id": oid,
	})
	if err := result.Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("comment", id, err)
		}
		return nil, err
	}

	var c v1alpha.Comment
	if err := result.Decode(&c); err != nil {
		return nil, fmt.Errorf("failed to decode comment: %w", err)
	}

	return &c, nil
}

func (db *database) ByKey(ctx context.Context, key string, prefix bool) ([]v1alpha.Comment, error) {
	opts := options.Find()

	opts.SetSort(bson.M{
		"createdAt": 1,
	})

	filter := bson.M{
		"key": key,
	}

	if prefix {
		filter = bson.M{
			"key": bson.M{
				"$regex": primitive.Regex{
					Pattern: "^" + key,
					Options: "i",
				},
			},
		}
	}

	results, err := db.comments.Find(ctx, filter, opts)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("comments", key, err)
		}
		return nil, fmt.Errorf("failed to query comments: %w", err)
	}
	defer results.Close(ctx)

	var comments []v1alpha.Comment
	if err := results.All(ctx, &comments); err != nil {
		return nil, fmt.Errorf("failed to decode comments: %w", err)
	}

	return comments, nil
}
