package patientdb

import "github.com/tierklinik-dobersberg/cis/internal/database/dbutils"

type SearchOptions struct {
	dbutils.SimpleQueryBuilder
}

func (opts *SearchOptions) ByCustomer(source string, id int) *SearchOptions {
	opts.WhereIn("customerSource", source)
	opts.WhereIn("customerID", id)
	return opts
}

func (opts *SearchOptions) ByAnimalNumber(id string) *SearchOptions {
	opts.WhereIn("animalID", id)
	return opts
}
