package customerdb

import (
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
	"go.mongodb.org/mongo-driver/bson"
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
				"$cond": bson.M{
					"if": bson.M{
						"$ne": bson.A{"distinctPhoneNumbers", bson.A{}},
					},
					"then": bson.M{
						"$sum": 1,
					},
					"else": nil,
				},
			},
		},
		Collection: db.customers,
	}
}
