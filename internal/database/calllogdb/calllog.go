package calllogdb

import (
	"context"
	"fmt"
	"time"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var log = pkglog.New("calllogdb")

// Database supports storing and retrieving of calllog records.
type Database interface {
	// CreateUnidentified creates new "unidentified" calllog record where
	// we don't know the caller.
	CreateUnidentified(ctx context.Context, log v1alpha.CallLog) error
	// RecordCustomerCall records a call that has been associated with a customer.
	// When called, RecordCustomerCall searches for an "unidentified" calllog that
	// was recorded at the same time and replaces that entry.
	RecordCustomerCall(ctx context.Context, record v1alpha.CallLog) error
	// Search searches for all records that match query.
	Search(ctx context.Context, query *SearchQuery) ([]v1alpha.CallLog, error)
}

type database struct {
	callogs *mongo.Collection
	country string
}

// NewWithClient creates a new client.
func NewWithClient(ctx context.Context, dbName, country string, cli *mongo.Client) (Database, error) {
	db := &database{
		callogs: cli.Database(dbName).Collection("callogs"),
		country: country,
	}

	if err := db.setup(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *database) setup(ctx context.Context) error {
	_, err := db.callogs.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "datestr", Value: 1},
			},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys: bson.D{
				{Key: "caller", Value: 1},
			},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys: bson.D{
				{Key: "customerID", Value: 1},
				{Key: "customerSource", Value: 1},
			},
			Options: options.Index().SetSparse(true),
		},
		{
			Keys: bson.D{
				{Key: "agent", Value: 1},
			},
			Options: options.Index().SetSparse(true),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	return nil
}

func (db *database) CreateUnidentified(ctx context.Context, record v1alpha.CallLog) error {
	if err := db.perpareRecord(ctx, &record); err != nil {
		return err
	}

	result, err := db.callogs.InsertOne(ctx, record)
	if err != nil {
		return err
	}

	// Just make sure the result is what we expect.
	if id, ok := result.InsertedID.(primitive.ObjectID); ok {
		record.ID = id
	} else {
		log.From(ctx).Errorf("invalid type in result.InsertedID, expected primitive.ObjectID but got %T", result.InsertedID)
	}

	return nil
}

func (db *database) RecordCustomerCall(ctx context.Context, record v1alpha.CallLog) error {
	log := log.From(ctx)
	if err := db.perpareRecord(ctx, &record); err != nil {
		return err
	}

	// load all records that happend on the same date with the same caller
	opts := options.Find().SetSort(bson.M{
		"date": -1,
	})
	filter := bson.M{
		"datestr": record.DateStr,
		"caller":  record.Caller,
	}
	log.Infof("searching for %+v", filter)
	cursor, err := db.callogs.Find(ctx, filter, opts)
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	// we accept any records that happend +- 2 minutes
	lower := record.Date.Add(-2 * time.Minute)
	upper := record.Date.Add(+2 * time.Minute)
	found := false
	var existing v1alpha.CallLog

	for cursor.Next(ctx) {
		if err := cursor.Decode(&existing); err != nil {
			log.Errorf("failed to decode existing calllog record: %s", err)
		} else {
			if lower.Before(existing.Date) && upper.After(existing.Date) {
				found = true
				break
			}
		}
	}
	// we only log error here and still create the record.
	if cursor.Err() != nil {
		log.Errorf("failed to search for unidentified calllog record: %s", cursor.Err())
	}

	if found {
		// copy exising values to the new record
		record.ID = existing.ID
		record.InboundNumber = existing.InboundNumber

		result := db.callogs.FindOneAndReplace(ctx, bson.M{"_id": record.ID}, record)
		if result.Err() != nil {
			return result.Err()
		}

		log.Infof("replaced unidentified calllog for %s with customer-record for %s:%s", record.Caller, record.CustomerSource, record.CustomerID)
	} else {
		_, err := db.callogs.InsertOne(ctx, record)
		if err != nil {
			return err
		}

		log.Infof("created new customer-record for %s:%s with phone number %s", record.CustomerSource, record.CustomerID, record.Caller)
	}

	return nil
}

func (db *database) Search(ctx context.Context, query *SearchQuery) ([]v1alpha.CallLog, error) {
	filter := query.Build()
	log.From(ctx).Infof("Searching callogs for %+v", filter)

	opts := options.Find().SetSort(bson.M{"date": -1})
	cursor, err := db.callogs.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var records []v1alpha.CallLog
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}

	return records, nil
}

func (db *database) perpareRecord(ctx context.Context, record *v1alpha.CallLog) error {
	formattedNumber := ""
	if record.Caller != "Anonymous" {
		parsed, err := phonenumbers.Parse(record.Caller, db.country)
		if err != nil {
			log.From(ctx).Errorf("failed to parse caller phone number %s: %s", record.Caller, err)
			return err
		}
		formattedNumber = phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL)
	} else {
		formattedNumber = "anonymous"
	}

	record.Caller = formattedNumber
	record.DateStr = record.Date.Format("2006-01-02")
	return nil
}
