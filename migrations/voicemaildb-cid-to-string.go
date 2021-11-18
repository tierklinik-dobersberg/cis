//nolint:dupl
package migrations

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/pkg/models/voicemail/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	schema.Add(
		schema.Migration{
			Key:         "voicemaildb",
			Description: "Migrate customer IDs from int to string",
			Version:     "v0.1.0",
			MigrateFunc: func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error {
				type v0Record struct {
					v1alpha.VoiceMailRecord `bson:",inline"`
					CustomerID              int `bson:"customerID"`
				}

				col := cli.Collection(voicemaildb.VoicemailCollection)
				records, err := col.Find(ctx, bson.M{})
				if err != nil {
					return fmt.Errorf("failed to find documents: %w", err)
				}

				for records.Next(ctx) {
					var rec v0Record
					if err := records.Decode(&rec); err != nil {
						return fmt.Errorf("failed to decode customer: %w", err)
					}

					rec.VoiceMailRecord.CustomerID = fmt.Sprintf("%d", rec.CustomerID)

					upd, err := col.ReplaceOne(ctx, bson.M{"_id": rec.ID}, rec.VoiceMailRecord)
					if err != nil {
						return fmt.Errorf("failed to replace %s: %w", rec.ID, err)
					}
					if upd.ModifiedCount != 1 {
						return fmt.Errorf("failed to replace %s (modified-count = %d)", rec.ID, upd.ModifiedCount)
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
