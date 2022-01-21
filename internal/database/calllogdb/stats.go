package calllogdb

import (
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func (db *database) Stats() *dbutils.Stats {
	return &dbutils.Stats{
		Collection: db.callogs,
		ValidGroupBys: map[string]primitive.M{
			"caller":          nil,
			"inboundNumber":   nil,
			"date":            nil,
			"callType":        nil,
			"dateStr":         nil,
			"agent":           nil,
			"customerID":      nil,
			"customerSource":  nil,
			"error":           nil,
			"transferTarget":  nil,
			"durationSeconds": nil,
		},
		ValidCounts: map[string]primitive.M{
			"totalDuration": bson.M{
				"$sum": "$durationSeconds",
			},
			"distinctCallers": bson.M{
				"$addToSet": "$caller",
			},
		},
		ValidTimeKeys: map[string]struct{}{
			"date": {},
		},
	}
}
