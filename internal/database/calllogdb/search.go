package calllogdb

import (
	"fmt"
	"time"

	"github.com/nyaruka/phonenumbers"
	"go.mongodb.org/mongo-driver/bson"
)

// SearchQuery searches for calllog records that match the specified
// query.
type SearchQuery struct {
	f bson.M
}

func (q *SearchQuery) prepare() {
	if q.f == nil {
		q.f = make(bson.M)
	}
}

// AtDate searches for all calllog records that happened at
// the day d.
func (q *SearchQuery) AtDate(d time.Time) *SearchQuery {
	return q.add("datestr", d.Format("2006-01-02"))
}

// After matches all calllog records that happend after d.
func (q *SearchQuery) After(d time.Time) *SearchQuery {
	return q.set("date", "$gt", d)
}

// Before matches all records that happened before d.
func (q *SearchQuery) Before(d time.Time) *SearchQuery {
	return q.set("date", "$lt", d)
}

// Between matches all records that were created before start - end.
func (q *SearchQuery) Between(start, end time.Time) *SearchQuery {
	return q.
		set("date", "$ge", start).
		set("date", "$le", end)
}

// CallerString matches all records where the caller exactly matches number.
// Use Caller() if you want to match regardless of the number format.
func (q *SearchQuery) CallerString(number string) *SearchQuery {
	return q.add("caller", number)
}

// Caller matches all records where match the caller number.
func (q *SearchQuery) Caller(number *phonenumbers.PhoneNumber) *SearchQuery {
	return q.
		add("caller", phonenumbers.Format(number, phonenumbers.INTERNATIONAL)).
		add("caller", phonenumbers.Format(number, phonenumbers.NATIONAL))
}

// InboundNumberString matches all records where the inbound-number exactly matches number.
// Use InboundNumber() if you want to match regardless of the number format.
func (q *SearchQuery) InboundNumberString(number string) *SearchQuery {
	return q.add("inboundNumber", number)
}

// InboundNumber matches all records where the inbound-number matches number.
func (q *SearchQuery) InboundNumber(number *phonenumbers.PhoneNumber) *SearchQuery {
	return q.
		add("inboundNumber", phonenumbers.Format(number, phonenumbers.INTERNATIONAL)).
		add("inboundNumber", phonenumbers.Format(number, phonenumbers.NATIONAL))
}

// Customer matches all records that are associated with customer.
func (q *SearchQuery) Customer(source, id string) *SearchQuery {
	return q.
		add("customerID", id).
		add("customerSource", source)
}

// TransferTarget matches the transfer target of the +call.
func (q *SearchQuery) TransferTarget(t string) *SearchQuery {
	return q.add("transferTarget", t)
}

func (q *SearchQuery) set(key string, operator string, value interface{}) *SearchQuery {
	q.prepare()

	if e, ok := q.f[key]; ok {
		switch m := e.(type) {
		case bson.M:
			m[operator] = value
		default:
			panic(fmt.Sprintf("unexpected value in search filter for %s: %T", key, e))
		}
		return q
	}
	q.f[key] = bson.M{
		operator: value,
	}
	return q
}

func (q *SearchQuery) add(key string, value interface{}) *SearchQuery {
	q.prepare()

	if e, ok := q.f[key]; ok {
		switch m := e.(type) {
		case bson.M:
			m["$in"] = append(m["$in"].(bson.A), value)
		default:
			q.f[key] = bson.M{
				"$in": bson.A{m, value},
			}
		}
		return q
	}

	q.f[key] = value
	return q
}
