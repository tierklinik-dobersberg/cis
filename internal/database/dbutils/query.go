package dbutils

import (
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
)

// SimpleQueryBuilder is a simple MongoDB query builder.
type SimpleQueryBuilder struct {
	f bson.M
}

func (q *SimpleQueryBuilder) prepare() {
	if q.f == nil {
		q.f = make(bson.M)
	}
}

// Where matches MongoDB documents where key matches value using operator.
// If Where overwrites any other "where clause" that used the same key and operator.
func (q *SimpleQueryBuilder) Where(key string, operator string, value interface{}) *SimpleQueryBuilder {
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

// WhereIn searches from MongoDB documents where the value of key is in a list of
// values. WhereIn addes value to this list of queried values.
func (q *SimpleQueryBuilder) WhereIn(key string, value interface{}) *SimpleQueryBuilder {
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

// Build returns the result of the query builder as a bson.M. If Build() is called on
// a nil value it returns an empty bson.M that would match all documents.
func (q *SimpleQueryBuilder) Build() bson.M {
	if q == nil || q.f == nil {
		return bson.M{}
	}
	return q.f
}
