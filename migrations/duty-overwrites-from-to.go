package migrations

import (
	"context"
	"fmt"
	"time"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/internal/roster"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	schema.Default.Add(schema.Migration{
		Description:       "Migrate from a singe Date to From and To",
		Key:               "rosterdb",
		Version:           "v0.2.0",
		BackupCollections: []string{roster.OverwriteJournal},
		MigrateFunc: func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error {
			type v0 struct {
				ID          primitive.ObjectID `bson:"_id,omitempty"`
				Date        string             `bson:"date"` // YYYY-MM-DD
				Username    string             `bson:"username,omitempty"`
				PhoneNumber string             `bson:"phoneNumber,omitempty"`
				DisplayName string             `bson:"displayName,omitempty"`
				Deleted     bool               `bson:"deleted,omitempty"`
				CreatedBy   string             `bson:"createdBy,omitempty"`
				CreatedAt   time.Time          `bson:"createdAt,omitempty"`
			}

			col := cli.Collection(roster.OverwriteJournal)

			records, err := col.Find(ctx, bson.M{})
			if err != nil {
				return fmt.Errorf("failed to find documents in overwrite journal: %w", err)
			}
			defer records.Close(ctx)

			for records.Next(ctx) {
				var r v0
				if err := records.Decode(&r); err != nil {
					return err
				}

				nr := v1alpha.Overwrite{
					ID:          r.ID,
					Username:    r.Username,
					PhoneNumber: r.PhoneNumber,
					DisplayName: r.DisplayName,
					Deleted:     r.Deleted,
					CreatedBy:   r.CreatedBy,
					CreatedAt:   r.CreatedAt,
				}

				d, err := time.ParseInLocation("2006-01-02", r.Date, time.Local)
				if err != nil {
					return fmt.Errorf("cannot parse date %q from old roster entry: %w", r.Date, err)
				}

				nr.From = d
				nr.To = time.Date(d.Year(), d.Month(), d.Day()+1, 8, 0, 0, 0, d.Location())

				upd, err := col.ReplaceOne(ctx, bson.M{"_id": r.ID}, nr)
				if err != nil {
					return fmt.Errorf("failed to replace %s: %w", r.ID, err)
				}
				if upd.ModifiedCount != 1 {
					return fmt.Errorf("failed to replace %s", r.ID)
				}
			}

			if records.Err() != nil {
				return fmt.Errorf("failed to iterate documents: %w", records.Err())
			}

			return nil
		},
	})
}
