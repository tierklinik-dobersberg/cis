package customerdb

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/antzucaro/matchr"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("customerdb")

// CustomerCollection is the MongoDB collection name
// that holds all customers.
const CustomerCollection = "customers"

// Database encapsulates access to the MongoDB database.
type Database interface {
	// CreateCustomer creates a new customer.
	CreateCustomer(ctx context.Context, cu *Customer) error

	// UpdateCustomer replaces an existing customer
	UpdateCustomer(ctx context.Context, cu *Customer) error

	// CustomerByCID returns the customer by it's customer-id
	CustomerByCID(ctx context.Context, source string, cid string) (*Customer, error)

	// FilterCustomer filters all customers according to filter.
	FilterCustomer(ctx context.Context, filter bson.M) ([]*Customer, error)

	// FuzzySearchName searches for a customer by name usign fuzzy-search
	FuzzySearchName(ctx context.Context, name string) ([]*Customer, error)

	// SearchCustomerByName searches for all customers that matches
	// name.
	SearchCustomerByName(ctx context.Context, name string) ([]*Customer, error)

	// DeleteCustomer deletes the customer identified by source and cid.
	DeleteCustomer(ctx context.Context, id string) error

	// Cursor returns a cursor for all objects in filter.
	Cursor(ctx context.Context, filter bson.M) (*mongo.Cursor, error)
}

type database struct {
	cli       *mongo.Client
	customers *mongo.Collection
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
		cli:       client,
		customers: client.Database(dbName).Collection(CustomerCollection),
	}

	// prepare collections and indexes.
	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	// Create a text index for $text search support.
	_, err := db.customers.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.M{
				"nameMetaphone": "text",
			},
		},
		{
			Keys: bson.M{
				"phoneNumbers": 1,
			},
		},
		{
			Keys: bson.M{
				"mailAddresses": 1,
			},
		},
		{
			Keys: bson.M{
				"cid":            1,
				"customerSource": 1,
			},
		},
		{
			Keys: bson.M{
				"linkedTo": 1,
			},
		},
	})

	if err != nil {
		return fmt.Errorf("creating indexes: %w", err)
	}

	return nil
}

func (db *database) CreateCustomer(ctx context.Context, cu *Customer) error {
	if !cu.ID.IsZero() {
		return fmt.Errorf("customer %s already has an object ID: %s", cu.CustomerID, cu.ID.Hex())
	}

	metaphone1, metaphone2 := matchr.DoubleMetaphone(cu.Name)
	cu.NameMetaphone = metaphone1 + " " + metaphone2
	if !cu.CreatedAt.IsZero() {
		return fmt.Errorf("customer has createdAt set to %s already", cu.CreatedAt)
	}
	if !cu.ModifiedAt.IsZero() {
		return fmt.Errorf("customer has modifiedAt set to %s already", cu.ModifiedAt)
	}

	cu.CreatedAt = time.Now()
	cu.ModifiedAt = time.Now()

	result, err := db.customers.InsertOne(ctx, cu)
	if err != nil {
		return fmt.Errorf("failed to insert customer: %w", err)
	}

	// result.InsertedID should be a primitiv.ObjectID if generated
	// by the driver. This check is only to ensure we don't panic
	if id, ok := result.InsertedID.(primitive.ObjectID); ok {
		cu.ID = id
	} else {
		log.From(ctx).Errorf("invalid type in result.InsertedID, expected primitv.ObjectID but got %T", result.InsertedID)
	}

	return nil
}

func (db *database) UpdateCustomer(ctx context.Context, cu *Customer) error {
	if cu.ID.IsZero() {
		return fmt.Errorf("cannot update customer without object ID")
	}

	metaphone1, metaphone2 := matchr.DoubleMetaphone(cu.Name)
	cu.NameMetaphone = metaphone1 + " " + metaphone2

	if cu.CreatedAt.IsZero() {
		cu.CreatedAt = time.Now()
	}
	cu.ModifiedAt = time.Now()

	result, err := db.customers.ReplaceOne(ctx, bson.M{"_id": cu.ID}, cu)
	if err != nil {
		return fmt.Errorf("failed to replace customer %s: %w", cu.ID, err)
	}

	if result.ModifiedCount != 1 || result.MatchedCount != 1 {
		return fmt.Errorf("expected to update one customer but matched %d and modified %d", result.MatchedCount, result.ModifiedCount)
	}

	return nil
}

func (db *database) FuzzySearchName(ctx context.Context, name string) ([]*Customer, error) {
	m1, m2 := matchr.DoubleMetaphone(name)
	customers, err := db.findCustomers(ctx, bson.M{
		"$text": bson.M{
			"$search":   m1 + " " + m2,
			"$language": "de",
		},
	})

	if err != nil {
		return nil, err
	}

	nameLower := strings.ToLower(name)
	distances := make([]fuzzyDistance, len(customers))
	for idx, cu := range customers {
		distances[idx] = fuzzyDistance{
			Customer: cu,
			Distance: matchr.DamerauLevenshtein(strings.ToLower(cu.Name), nameLower),
		}
	}

	sort.Sort(distanceSort(distances))

	result := make([]*Customer, len(distances))

	for idx, item := range distances {
		result[idx] = item.Customer
	}

	return result, nil
}

func (db *database) CustomerByCID(ctx context.Context, source string, cid string) (*Customer, error) {
	filter := bson.M{
		"cid":            cid,
		"customerSource": source,
	}

	return db.findSingleCustomer(ctx, filter)
}

func (db *database) SearchCustomerByName(ctx context.Context, name string) ([]*Customer, error) {
	return db.findCustomers(ctx, bson.M{
		"$text": bson.M{
			"$search":        name,
			"$caseSensitive": true,
		},
	})
}

func (db *database) FilterCustomer(ctx context.Context, filter bson.M) ([]*Customer, error) {
	return db.findCustomers(ctx, filter)
}

func (db *database) Cursor(ctx context.Context, filter bson.M) (*mongo.Cursor, error) {
	return db.customers.Find(ctx, filter)
}

func (db *database) DeleteCustomer(ctx context.Context, id string) error {
	dbid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("failed to parse customer object id %q: %w", id, err)
	}
	result, err := db.customers.DeleteOne(ctx, bson.M{
		"_id": dbid,
	})
	if err != nil {
		return fmt.Errorf("failed to delete customer: %w", err)
	}
	if result.DeletedCount != 1 {
		return ErrNotFound
	}
	return nil
}

func (db *database) findCustomers(ctx context.Context, filter interface{}) ([]*Customer, error) {
	result, err := db.customers.Find(ctx, filter)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}

		return nil, fmt.Errorf("failed to query for customers: %w", err)
	}
	defer result.Close(ctx)

	var customers []*Customer

	if err := result.All(ctx, &customers); err != nil {
		return nil, fmt.Errorf("failed to decode customers: %w", err)
	}

	return customers, nil
}

func (db *database) findSingleCustomer(ctx context.Context, filter interface{}) (*Customer, error) {
	result := db.customers.FindOne(ctx, filter)
	if err := result.Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("customer", fmt.Sprintf("%+v", filter), ErrNotFound)
		}

		return nil, fmt.Errorf("failed to query for customer: %w", err)
	}

	var cu Customer
	if err := result.Decode(&cu); err != nil {
		return nil, fmt.Errorf("failed to decode customer: %w", err)
	}

	return &cu, nil
}

type fuzzyDistance struct {
	Customer *Customer
	Distance int
}

type distanceSort []fuzzyDistance

func (d distanceSort) Len() int { return len(d) }
func (d distanceSort) Less(i, j int) bool {
	return d[i].Distance < d[j].Distance
}
func (d distanceSort) Swap(i, j int) { d[i], d[j] = d[j], d[i] }
