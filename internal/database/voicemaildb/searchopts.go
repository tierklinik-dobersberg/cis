package voicemaildb

import (
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
)

// SearchOptions defines the criteria when searching for voicemail
// records.
type SearchOptions struct {
	dbutils.SimpleQueryBuilder
}

// ByDate only searches for voicemail records from the given date.
func (opts *SearchOptions) ByDate(d time.Time) *SearchOptions {
	opts.WhereIn("datestr", d.Format("2006-01-02"))
	return opts
}

// BySeen only searches for voicemail records that match seen.
func (opts *SearchOptions) BySeen(seen bool) *SearchOptions {
	if seen {
		opts.Where("read", "$eq", true)
	} else {
		opts.Where("read", "$ne", true)
	}
	return opts
}

// ByCustomer searches for voicemail records from the given customer.
func (opts *SearchOptions) ByCustomer(source, id string) *SearchOptions {
	opts.WhereIn("customerID", id)
	opts.WhereIn("customerSource", source)
	return opts
}

// ByVoiceMail searches for voicemail records that are stored in the
// specified voicemail.
func (opts *SearchOptions) ByVoiceMail(name string) *SearchOptions {
	opts.WhereIn("name", name)
	return opts
}
