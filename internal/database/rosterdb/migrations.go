package rosterdb

import (
	"context"
	"fmt"
	"time"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/roster/v1alpha"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	schema.Add(
		schema.Migration{
			Key:         "rosterdb",
			Description: "Migrate from emergency to onCall.day and onCall.night",
			Version:     "v0.1.0",
			MigrateFunc: func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error {
				type v0Day struct {
					Forenoon  []string        `bson:"forenoon,omitempty"`
					Afternoon []string        `bson:"afternoon,omitempty"`
					Emergency []string        `bson:"emergency,omitempty"`
					OnCall    *v1alpha.OnCall `bson:"onCall.omitempty"`
				}
				type v0Roster struct {
					ID    primitive.ObjectID `bson:"_id,omitempty"`
					Month time.Month         `bson:"month,omitempty"`
					Year  int                `bson:"year,omitempty"`
					Days  map[int]v0Day      `bson:"days,omitempty"`
				}

				col := cli.Collection(DutyRosterCollection)

				records, err := col.Find(ctx, bson.M{})
				if err != nil {
					return fmt.Errorf("failed to find documents: %w", err)
				}

			L:
				for records.Next(ctx) {
					var r v0Roster
					if err := records.Decode(&r); err != nil {
						return err
					}
					newR := v1alpha.DutyRoster{
						ID:    r.ID,
						Month: r.Month,
						Year:  r.Year,
						Days:  make(map[int]v1alpha.Day),
					}

					for idx, day := range r.Days {
						// if there's already an OnCall property this record
						// has been migrated. Skip it
						if day.OnCall != nil {
							continue L
						}
						newDay := v1alpha.Day{
							Forenoon:  day.Forenoon,
							Afternoon: day.Afternoon,
							OnCall: v1alpha.OnCall{
								Day:   day.Emergency,
								Night: day.Emergency,
							},
						}
						newR.Days[idx] = newDay
					}

					upd, err := col.ReplaceOne(ctx, bson.M{"_id": r.ID}, newR)
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
		},
	)
}
