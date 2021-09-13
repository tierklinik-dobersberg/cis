package migrations

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	schema.Add(
		schema.Migration{
			Key:         "customerdb",
			Description: "Migrate customer IDs from int to string",
			Version:     "v0.1.0",
			MigrateFunc: func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error {
				type v0Customer struct {
					customerdb.Customer `bson:",inline"`
					CustomerID          int `bson:"cid"`
				}

				col := cli.Collection(customerdb.CustomerCollection)
				records, err := col.Find(ctx, bson.M{})
				if err != nil {
					return fmt.Errorf("failed to find documents: %w", err)
				}

				for records.Next(ctx) {
					var cus v0Customer
					if err := records.Decode(&cus); err != nil {
						return fmt.Errorf("failed to decode customer: %w", err)
					}

					cus.Customer.CustomerID = fmt.Sprintf("%d", cus.CustomerID)

					upd, err := col.ReplaceOne(ctx, bson.M{"_id": cus.ID}, cus.Customer)
					if err != nil {
						return fmt.Errorf("failed to replace %s: %w", cus.ID, err)
					}
					if upd.ModifiedCount != 1 {
						return fmt.Errorf("failed to replace %s (modified-count = %d)", cus.ID, upd.ModifiedCount)
					}
				}

				if records.Err() != nil {
					return fmt.Errorf("failed to iterate documents: %w", records.Err())
				}
				return nil
			},
		},
	)
}
