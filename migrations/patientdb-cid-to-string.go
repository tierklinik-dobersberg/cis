//nolint:dupl
package migrations

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/pkg/models/patient/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	schema.Add(
		schema.Migration{
			Key:         "patientdb",
			Description: "Migrate customer IDs from int to string",
			Version:     "v0.1.0",
			MigrateFunc: func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error {
				type v0Patient struct {
					v1alpha.PatientRecord `bson:",inline"`
					CustomerID            int `bson:"customerID"`
				}

				col := cli.Collection(patientdb.CollectionName)
				records, err := col.Find(ctx, bson.M{})
				if err != nil {
					return fmt.Errorf("failed to find documents: %w", err)
				}

				for records.Next(ctx) {
					var pat v0Patient
					if err := records.Decode(&pat); err != nil {
						return fmt.Errorf("failed to decode customer: %w", err)
					}

					pat.PatientRecord.CustomerID = fmt.Sprintf("%d", pat.CustomerID)

					upd, err := col.ReplaceOne(ctx, bson.M{"_id": pat.ID}, pat.PatientRecord)
					if err != nil {
						return fmt.Errorf("failed to replace %s: %w", pat.ID, err)
					}
					if upd.ModifiedCount != 1 {
						return fmt.Errorf("failed to replace %s (modified-count = %d)", pat.ID, upd.ModifiedCount)
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
