package customerdb

import (
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
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
							"$ne": bson.A{"phoneNumbers", primitive.Null{}},
						},
						"then": 1,
						"else": 0,
					},
				},
			},
		},
		Collection: db.customers,
	}
}
