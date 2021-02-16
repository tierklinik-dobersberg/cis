package calllogdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Database supports storing and retrieving of calllog records.
type Database interface {
	// CreateUnidentified creates new "unidentified" calllog record where
	// we don't know the caller.
	CreateUnidentified(ctx context.Context, d time.Time, caller string, inboundNumber string) error
	// RecordCustomerCall records a call that has been associated with a customer.
	// When called, RecordCustomerCall searches for an "unidentified" calllog that
	// was recorded at the same time and replaces that entry.
	RecordCustomerCall(ctx context.Context, record v1alpha.CallLog) error
	// ForDate returns all calllogs recorded at d.
	ForDate(ctx context.Context, d time.Time) ([]v1alpha.CallLog, error)
	// ForCustomer returns all calllog records that are associated with the specified
	// customer.
	ForCustomer(ctx context.Context, source, id string) ([]v1alpha.CallLog, error)
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
			Keys: bson.M{
				"datestr": 1,
			},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys: bson.M{
				"caller": 1,
			},
			Options: options.Index().SetSparse(false),
		},
		{
			Keys: bson.M{
				"customerID":     1,
				"customerSource": 1,
			},
			Options: options.Index().SetSparse(true),
		},
		{
			Keys: bson.M{
				"agent": 1,
			},
			Options: options.Index().SetSparse(true),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	return nil
}

func (db *database) CreateUnidentified(ctx context.Context, d time.Time, caller string, inboundNumber string) error {
	formattedNumber := ""
	if caller != "Anonymous" {
		parsed, err := phonenumbers.Parse(caller, db.country)
		if err != nil {
			logger.Errorf(ctx, "failed to parse caller phone number %s: %s", caller, err)
			return err
		}
		formattedNumber = phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL)
	} else {
		formattedNumber = "anonymous"
	}

	log := v1alpha.CallLog{
		Caller:        formattedNumber,
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

func (db *database) RecordCustomerCall(ctx context.Context, record v1alpha.CallLog) error {
	formattedNumber := ""
	if record.Caller != "Anonymous" {
		parsed, err := phonenumbers.Parse(record.Caller, db.country)
		if err != nil {
			logger.Errorf(ctx, "failed to parse caller phone number %s: %s", record.Caller, err)
			return err
		}
		formattedNumber = phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL)
	} else {
		formattedNumber = "anonymous"
	}

	record.Caller = formattedNumber
	record.DateStr = record.Date.Format("1006-01-02")

	// load all records that happend on the same date with the same caller
	opts := options.Find().SetSort(bson.M{
		"date": -1,
	})
	filter := bson.M{
		"datestr": record.DateStr,
		"caller":  record.Caller,
	}
	logger.Infof(ctx, "searching for %+v", filter)
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
			logger.Errorf(ctx, "failed to decode existing calllog record: %s", err)
		} else {
			if lower.Before(existing.Date) && upper.After(existing.Date) {
				found = true
				break
			}
		}
	}
	// we only log error here and still create the record.
	if cursor.Err() != nil {
		logger.Errorf(ctx, "failed to search for unidentified calllog record: %s", cursor.Err())
	}

	if found {
		// copy exising values to the new record
		record.ID = existing.ID
		record.InboundNumber = existing.InboundNumber

		result := db.callogs.FindOneAndReplace(ctx, bson.M{"_id": record.ID}, record)
		if result.Err() != nil {
			return result.Err()
		}

		logger.Infof(ctx, "replaced unidentified calllog for %s with customer-record for %s:%s", record.Caller, record.CustomerSource, record.CustomerID)
	} else {
		_, err := db.callogs.InsertOne(ctx, record)
		if err != nil {
			return err
		}

		logger.Infof(ctx, "created new customer-record for %s:%s with phone number %s", record.CustomerSource, record.CustomerID, record.Caller)
	}

	return nil
}

func (db *database) ForDate(ctx context.Context, d time.Time) ([]v1alpha.CallLog, error) {
	key := d.Format("2006-01-02")

	opts := options.Find()
	opts.SetSort(bson.M{
		"date": -1,
	})

	result, err := db.callogs.Find(ctx, bson.M{"datestr": key}, opts)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	defer result.Close(ctx)

	var records []v1alpha.CallLog
	if err := result.All(ctx, &records); err != nil {
		return nil, err
	}

	return records, nil
}

func (db *database) ForCustomer(ctx context.Context, source, id string) ([]v1alpha.CallLog, error) {
	filter := bson.M{
		"customerSource": source,
		"customerID":     id,
	}
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
