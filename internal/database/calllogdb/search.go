package calllogdb

import (
	"time"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
)

// SearchQuery searches for calllog records that match the specified
// query.
type SearchQuery struct {
	dbutils.SimpleQueryBuilder
}

// AtDate searches for all calllog records that happened at
// the day d.
func (q *SearchQuery) AtDate(d time.Time) *SearchQuery {
	q.WhereIn("datestr", d.Format("2006-01-02"))
	return q
}

// After matches all calllog records that happened after d.
func (q *SearchQuery) After(d time.Time) *SearchQuery {
	q.Where("date", "$gt", d)
	return q
}

// Before matches all records that happened before d.
func (q *SearchQuery) Before(d time.Time) *SearchQuery {
	q.Where("date", "$lt", d)
	return q
}

// Between matches all records that were created before start - end.
func (q *SearchQuery) Between(start, end time.Time) *SearchQuery {
	q.
		Where("date", "$ge", start).
		Where("date", "$le", end)
	return q
}

// CallerString matches all records where the caller exactly matches number.
// Use Caller() if you want to match regardless of the number format.
func (q *SearchQuery) CallerString(number string) *SearchQuery {
	q.WhereIn("caller", number)
	return q
}

// Caller matches all records where match the caller number.
func (q *SearchQuery) Caller(number *phonenumbers.PhoneNumber) *SearchQuery {
	q.
		WhereIn("caller", phonenumbers.Format(number, phonenumbers.INTERNATIONAL)).
		WhereIn("caller", phonenumbers.Format(number, phonenumbers.NATIONAL))
	return q
}

// InboundNumberString matches all records where the inbound-number exactly matches number.
// Use InboundNumber() if you want to match regardless of the number format.
func (q *SearchQuery) InboundNumberString(number string) *SearchQuery {
	q.WhereIn("inboundNumber", number)
	return q
}

// InboundNumber matches all records where the inbound-number matches number.
func (q *SearchQuery) InboundNumber(number *phonenumbers.PhoneNumber) *SearchQuery {
	q.
		WhereIn("inboundNumber", phonenumbers.Format(number, phonenumbers.INTERNATIONAL)).
		WhereIn("inboundNumber", phonenumbers.Format(number, phonenumbers.NATIONAL))
	return q
}

// Customer matches all records that are associated with customer.
func (q *SearchQuery) Customer(source, id string) *SearchQuery {
	q.
		WhereIn("customerID", id).
		WhereIn("customerSource", source)
	return q
}

// TransferTarget matches the transfer target of the +call.
func (q *SearchQuery) TransferTarget(t string) *SearchQuery {
	q.WhereIn("transferTarget", t)
	return q
}
