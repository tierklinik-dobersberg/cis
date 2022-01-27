package patientdb

import (
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func (db *database) Stats() *dbutils.Stats {
	return &dbutils.Stats{
		Collection: db.collection,
		ValidGroupBys: map[string]primitive.M{
			"customerSource": nil,
			"customerID":     nil,
			"size":           nil,
			"species":        nil,
			"breed":          nil,
			"gender":         nil,
			"name":           nil,
			"birthday":       nil,
			"specialDetail":  nil,
			"animalID":       nil,
			"color":          nil,
			"chipNumber":     nil,
		},
	}
}
