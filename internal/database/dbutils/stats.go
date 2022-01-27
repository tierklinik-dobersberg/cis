package dbutils

import (
	"context"
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/stats"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var DateMongoFormat = map[string]string{
	"hour":  "%Y-%m-%d %H",
	"day":   "%Y-%m-%d",
	"month": "%Y-%m",
	"week":  "%V",
	"year":  "%Y",
}

var DateTimeFormat = map[string]string{
	"hour":  "2006-01-02 15",
	"day":   "2006-01-02",
	"month": "2006-01",
	"week":  "",
	"year":  "2006",
}

type Stats struct {
	ValidGroupBys map[string]bson.M
	ValidTimeKeys map[string]struct{}
	ValidCounts   map[string]bson.M
	Collection    *mongo.Collection
}

func (s *Stats) SimpleCount(ctx context.Context, counterKey string) (int, error) {
	counter, err := s.getCounter(counterKey)
	if err != nil {
		return 0, err
	}

	projection := bson.M{
		"count": bson.M{
			"$cond": bson.M{
				"if":   bson.M{"$isArray": "$count"},
				"then": bson.M{"$size": "$count"},
				"else": "$count",
			},
		},
	}

	res, err := s.Collection.Aggregate(ctx, mongo.Pipeline{
		// group stage
		bson.D{
			{Key: "$group", Value: bson.M{
				"_id":   nil,
				"count": counter,
			}},
		},
		// projection state
		bson.D{
			{Key: "$project", Value: projection},
		},
	})
	if err != nil {
		return 0, err
	}

	var r []struct {
		Count int `bson:"count"`
	}
	if err := res.All(ctx, &r); err != nil {
		return 0, err
	}
	if len(r) != 1 {
		return 0, fmt.Errorf("expected 1 result but got %d", len(r))
	}
	return r[0].Count, nil
}

func (s *Stats) SimpleGroupByOverTime(ctx context.Context, from, to time.Time, timeRange string, groupByKey, timeKey, counterKey string) ([]stats.TimeSeries, error) {
	if _, found := s.ValidTimeKeys[timeKey]; !found {
		return nil, httperr.BadRequest("invalid time key")
	}

	counter, err := s.getCounter(counterKey)
	if err != nil {
		return nil, err
	}

	mongoFormat, ok := DateMongoFormat[timeRange]
	if !ok {
		return nil, httperr.BadRequest("timeRange must be daily, monthly or yearly")
	}
	goFormat, _ := DateTimeFormat[timeRange]

	groupByFields := bson.M{
		"date": bson.M{
			"$dateToString": bson.M{
				"date":   "$" + timeKey,
				"format": mongoFormat,
			},
		},
	}

	if groupByKey != "" {
		grpBy, err := s.getGroupBy(groupByKey)
		if err != nil {
			return nil, err
		}
		groupByFields["group"] = grpBy
	}

	groupByClause := bson.M{
		"_id":   groupByFields,
		"count": counter,
	}
	projection := bson.M{
		"count": bson.M{
			"$cond": bson.M{
				"if":   bson.M{"$isArray": "$count"},
				"then": bson.M{"$size": "$count"},
				"else": "$count",
			},
		},
	}

	res, err := s.Collection.Aggregate(ctx, mongo.Pipeline{
		// matching stage
		bson.D{
			{Key: "$match", Value: bson.M{
				timeKey: bson.M{
					"$gte": from,
					"$lte": to,
				},
			}},
		},
		// group stage
		bson.D{
			{Key: "$group", Value: groupByClause},
		},
		// projection state
		bson.D{
			{Key: "$project", Value: projection},
		},
		// sort stage
		bson.D{
			{Key: "$sort", Value: bson.D{
				{Key: "_id.date", Value: 1},
			}},
		},
	})
	if err != nil {
		return nil, err
	}

	var r []struct {
		ID struct {
			Date  string `bson:"date"`
			Group string `bson:"group"`
		} `bson:"_id"`
		Count int `bson:"count"`
	}
	if err := res.All(ctx, &r); err != nil {
		return nil, err
	}

	lm := make(map[string][]stats.TimedValue)

	for _, rec := range r {
		d, _ := time.ParseInLocation(goFormat, rec.ID.Date, time.UTC)

		lm[rec.ID.Group] = append(lm[rec.ID.Group], stats.TimedValue{
			Value: rec.Count,
			Time:  d,
			Name:  rec.ID.Date,
		})
	}

	var result []stats.TimeSeries
	for id, val := range lm {
		result = append(result, stats.TimeSeries{
			ID:    id,
			Label: id,
			Data:  val,
		})
	}

	return result, nil
}

func (s *Stats) SimpleGroupBy(ctx context.Context, groupByKey string, counterKey string) ([]stats.Group, error) {
	grpBy, err := s.getGroupBy(groupByKey)
	if err != nil {
		return nil, err
	}

	counter, err := s.getCounter(counterKey)
	if err != nil {
		return nil, err
	}

	res, err := s.Collection.Aggregate(ctx, mongo.Pipeline{
		// group stage
		bson.D{
			{Key: "$group", Value: bson.M{
				"_id":   grpBy,
				"count": counter,
			}},
		},
		// sort stage by _id
		// FIXME(ppacher): whis will likely fail on _ids that are
		// objects.
		bson.D{
			{Key: "$sort", Value: bson.D{
				{Key: "_id", Value: 1},
			}},
		},
	})
	if err != nil {
		return nil, err
	}

	var result []struct {
		ID    string `bson:"_id"`
		Count int    `bson:"count"`
	}
	if err := res.All(ctx, &result); err != nil {
		return nil, err
	}

	var groups []stats.Group
	for _, r := range result {
		groups = append(groups, stats.Group{
			ID:    r.ID,
			Label: r.ID,
			Count: r.Count,
		})
	}

	return groups, nil
}

func (s *Stats) getGroupBy(groupByKey string) (bson.M, error) {
	grpBy, found := s.ValidGroupBys[groupByKey]
	if !found {
		return nil, httperr.InvalidParameter("group-by", groupByKey)
	}
	if grpBy == nil {
		grpBy = bson.M{
			"$toString": "$" + groupByKey,
		}
	}
	return grpBy, nil
}

func (s *Stats) getCounter(counterKey string) (bson.M, error) {
	if counterKey == "" || counterKey == "null" {
		return bson.M{
			"$sum": 1,
		}, nil
	}

	b, ok := s.ValidCounts[counterKey]
	if !ok {
		return nil, httperr.InvalidParameter("counter", counterKey)
	}
	return b, nil
}
