package permission

import "github.com/gin-gonic/gin"

// SetType fines if one or all actions of a set
// must be permitted.
type SetType string

// The different set types.
const (
	And = SetType("and")
	Or  = SetType("or")
)

// Set defines a permission set.
type Set interface {
	// Type returns the set type. Either "and" or "or"
	Type() SetType
	// Actions returns all actions defined in the set.
	Actions() []*Action
}

// OneOf is a list of actions from which the session must
// be allowed at least one in order to be allowed to use
// the annotated API endpoint.
type OneOf []*Action

// Type implements Set
func (oneof OneOf) Type() SetType { return Or }

// Actions implements Set
func (oneof OneOf) Actions() []*Action { return ([]*Action)(oneof) }

// Union is a list of actions from which the session must
// be allowed all in order to be allowed to use
// the annotated API endpoint.
type Union []*Action

// Type implements Set
func (union Union) Type() SetType { return And }

// Actions implements Set
func (union Union) Actions() []*Action { return ([]*Action)(union) }

// Anyone defines that anyone can use the annotated API.
// It's equal to using a nil Set.
var Anyone = Set(nil)

// Require is a gin middleware that enforces
// permission requirements.
func Require(set OneOf) gin.HandlerFunc {
	return func(c *gin.Context) {

	}
}
