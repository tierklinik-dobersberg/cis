package permission

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/session"
)

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
func Require(matcher *Matcher, set Set) gin.HandlerFunc {
	return func(c *gin.Context) {
		sess := session.Get(c)
		if sess == nil && set != nil && len(set.Actions()) > 0 {
			httperr.Forbidden(nil, "no session").AbortRequest(c)
			return
		}

		if set != nil {
			for _, action := range set.Actions() {
				var resource string
				if action.ResourceName != nil {
					var err error
					resource, err = action.ResourceName(c)
					if err != nil {
						httperr.Abort(c, err)
						return
					}
				}

				req := Request{
					Action:   action.Name,
					Resource: resource,
					User:     sess.User.Name,
				}

				allowed, err := matcher.Decide(c.Request.Context(), &req)
				if err != nil {
					httperr.InternalError(err).AbortRequest(c)
					return
				}

				if allowed && set.Type() == Or {
					c.Next()
					return
				}

				if !allowed && set.Type() == And {
					httperr.Forbidden(
						nil,
						fmt.Sprintf("Not allowed to perform %s on %q", action.Name, resource),
					).AbortRequest(c)
					return
				}
			}

			if set.Type() == Or {
				httperr.Forbidden(nil, "all actions declined").AbortRequest(c)
				return
			}
		}

		// If set.Type() == And and we reach this point than
		// all actions are allowed.
		c.Next()
	}
}
