package customerdb

import (
	"context"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/stats"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var dateMongoFormat = map[string]string{
	"daily":   "%Y-%m-%d",
	"monthly": "%Y-%m",
	"yearly":  "%Y",
}

var dateTimeFormat = map[string]string{
	"daily":   "2006-01-02",
	"monthly": "2006-01",
	"yearly":  "2006",
}

type Statistician struct {
	db *database
}

func (db *database) Stats() *Statistician {
	return &Statistician{db}
}

func (s *Statistician) NewCustomers(ctx context.Context, from, to time.Time, timeRange string) ([]stats.TimeSeries, error) {
	log.From(ctx).Infof("loading customers that have been created between %s and %s", from.Format(time.RFC3339), to.Format(time.RFC3339))

	mongoFormat, ok := dateMongoFormat[timeRange]
	if !ok {
		return nil, httperr.BadRequest(nil, "timeRange must be daily, monthly or yearly")
	}

	res, err := s.db.customers.Aggregate(ctx, mongo.Pipeline{
		// matching stage
		bson.D{
			{Key: "$match", Value: bson.M{
				"createdat": bson.M{
					"$gte": from,
					"$lte": to,
				},
			}},
		},
		// group stage
		bson.D{
			{Key: "$group", Value: bson.M{
				"_id": bson.M{
					"date": bson.M{
						"$dateToString": bson.M{
							"date":   "$createdat",
							"format": mongoFormat,
						},
					},
					"source": "$customerSource",
				},
				"count": bson.M{
					"$sum": 1,
				},
			}},
		},
		// sort stage
		bson.D{
			{Key: "$sort", Value: bson.D{
				{Key: "date", Value: 1},
			}},
		},
	})
	if err != nil {
		return nil, err
	}

	var r []struct {
		ID struct {
			Date   string `bson:"date"`
			Source string `bson:"source"`
		} `bson:"_id"`
		Count int `bson:"count"`
	}
	if err := res.All(ctx, &r); err != nil {
		return nil, err
	}

	lm := make(map[string][]stats.TimedValue)

	for _, rec := range r {
		d, _ := time.ParseInLocation("2006-01-02", rec.ID.Date, time.UTC)

		lm[rec.ID.Source] = append(lm[rec.ID.Source], stats.TimedValue{
			Value: rec.Count,
			Time:  d,
			Name:  rec.ID.Date,
		})
	}

	var result []stats.TimeSeries
	for id, val := range lm {
		result = append(result, stats.TimeSeries{
			ID:     id,
			Name:   id,
			Series: val,
		})
	}

	return result, nil
}
