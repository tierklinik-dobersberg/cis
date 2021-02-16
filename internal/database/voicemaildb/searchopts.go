package voicemaildb

import (
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// SearchOptions defines the criteria when searching for voicemail
// records.
type SearchOptions struct {
	Date           *time.Time
	Seen           *bool
	CustomerSource *string
	CustomerID     *string
	VoiceMail      *string
}

// ByDate only searches for voicemail records from the given date.
func (opts *SearchOptions) ByDate(d time.Time) *SearchOptions {
	opts.Date = &d
	return opts
}

// BySeen only searches for voicemail records that match seen.
func (opts *SearchOptions) BySeen(seen bool) *SearchOptions {
	opts.Seen = &seen
	return opts
}

// ByCustomer searches for voicemail records from the given customer.
func (opts *SearchOptions) ByCustomer(source, id string) *SearchOptions {
	opts.CustomerID = &id
	opts.CustomerSource = &source

	return opts
}

// ByVoiceMail searches for voicemail records that are stored in the
// specified voicemail.
func (opts *SearchOptions) ByVoiceMail(name string) *SearchOptions {
	opts.VoiceMail = &name
	return opts
}

func (opts *SearchOptions) toFilter() bson.M {
	res := bson.M{}
	if opts == nil {
		return res
	}

	if opts.CustomerID != nil {
		res["customerID"] = *opts.CustomerID
	}

	if opts.CustomerSource != nil {
		res["customerSource"] = *opts.CustomerSource
	}

	if opts.Date != nil {
		res["datestr"] = opts.Date.Format("2006-01-02")
	}

	if opts.Seen != nil {
		if *opts.Seen {
			res["read"] = true
		} else {
			res["read"] = bson.M{
				"$ne": true,
			}
		}
	}

	if opts.VoiceMail != nil {
		res["name"] = *opts.VoiceMail
	}

	return res
}
