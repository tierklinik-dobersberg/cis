package customerdb

import (
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
	"go.mongodb.org/mongo-driver/bson"
)

var validGroupByKeys = map[string]bson.M{
	"cid":                 nil,
	"group":               nil,
	"name":                nil,
	"firstname":           nil,
	"title":               nil,
	"street":              nil,
	"cityCode":            nil,
	"city":                nil,
	"vaccinationReminder": nil,
	"customerSource":      nil,
}

func (db *database) Stats() *dbutils.Stats {
	return &dbutils.Stats{
		ValidGroupBys: validGroupByKeys,
		ValidTimeKeys: map[string]struct{}{
			"createdat": {},
		},
		ValidCounts: map[string]bson.M{
			"invalidNumbers": {
				"$sum": bson.M{
					"$cond": bson.M{
						"if": bson.M{
							"$eq": bson.A{"array", bson.M{"$type": "$phoneNumbers"}},
						},
						"then": bson.M{
							"$cond": bson.M{
								"if": bson.M{
									"$gt": bson.A{bson.M{"$size": "$phoneNumbers"}, 0},
								},
								"then": 0,
								"else": 1,
							},
						},
						"else": 1,
					},
				},
			},
			"distinctCities": bson.M{
				"$addToSet": "$cityCode",
			},
		},
		Collection: db.customers,
	}
}
